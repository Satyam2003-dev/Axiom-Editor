/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { basename, join, resolve } from 'path';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { ILocalModelService, LocalAccelerationInfo, LocalModelFormat, LocalModelInfo, LocalModelManagerState, LocalModelOperationProgress, LocalModelRuntime, LocalRuntimeStatus } from '../common/localModelService.js';

const trimEndpoint = (endpoint: string) => endpoint.trim().replace(/\/+$/, '');
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export class LocalModelMainService extends Disposable implements ILocalModelService {
	readonly _serviceBrand: undefined;
	private readonly progressEmitter = this._register(new Emitter<LocalModelOperationProgress>());
	readonly onDidProgress = this.progressEmitter.event;
	private activeAbortController: AbortController | undefined;
	private activeProcess: ChildProcess | undefined;
	private llamaServerProcess: ChildProcess | undefined;

	constructor(@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService) {
		super();
	}

	private get modelDirectory(): string {
		return join(this.environmentMainService.userDataPath, 'axiom-models');
	}

	private async commandAvailable(command: string, args: readonly string[] = ['--version']): Promise<boolean> {
		return new Promise(resolve => {
			const child = spawn(command, [...args], { windowsHide: true, stdio: 'ignore' });
			const timeout = setTimeout(() => { child.kill(); resolve(false); }, 2500);
			child.once('error', () => { clearTimeout(timeout); resolve(false); });
			child.once('exit', code => { clearTimeout(timeout); resolve(code === 0); });
		});
	}

	private async acceleration(): Promise<LocalAccelerationInfo> {
		const platform = process.platform;
		const architecture = process.arch;
		if (platform === 'darwin' && architecture === 'arm64') {
			return { backend: 'MLX', detail: 'Apple Silicon detected. Use MLX in LM Studio for native unified-memory acceleration; Metal GGUF remains available.', platform, architecture };
		}
		if (platform === 'darwin') {
			return { backend: 'Metal', detail: 'Intel macOS detected. MLX requires Apple Silicon, so use a Metal-capable GGUF runtime or CPU.', platform, architecture };
		}
		if (await this.commandAvailable('nvidia-smi')) {
			return { backend: 'CUDA', detail: 'NVIDIA GPU detected. Ollama and LM Studio can automatically offload supported model layers to CUDA.', platform, architecture };
		}
		if (platform === 'linux' && await this.commandAvailable('rocminfo')) {
			return { backend: 'ROCm', detail: 'AMD ROCm detected. Prefer a ROCm-enabled runtime; Vulkan is the compatibility fallback.', platform, architecture };
		}
		if (await this.commandAvailable('vulkaninfo', ['--summary'])) {
			return { backend: 'Vulkan', detail: 'Vulkan device support detected. Use it when CUDA or ROCm is unavailable.', platform, architecture };
		}
		return { backend: 'CPU', detail: 'No supported GPU toolchain was detected. Local models remain usable with CPU inference.', platform, architecture };
	}

	private async ollamaStatus(endpoint: string): Promise<LocalRuntimeStatus> {
		const cliAvailable = await this.commandAvailable('ollama');
		try {
			const response = await fetch(`${trimEndpoint(endpoint)}/api/tags`, { signal: AbortSignal.timeout(3000) });
			if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
			const data = await response.json() as { models?: Array<{ name?: string; size?: number; details?: { format?: string; quantization_level?: string } }> };
			const models: LocalModelInfo[] = (data.models ?? []).filter(model => !!model.name).map(model => ({
				id: model.name!, size: model.size, format: model.details?.format, quantization: model.details?.quantization_level
			}));
			return { runtime: 'ollama', available: true, cliAvailable, endpoint, models };
		} catch (error) {
			return { runtime: 'ollama', available: false, cliAvailable, endpoint, models: [], error: errorMessage(error) };
		}
	}

	private async lmStudioStatus(endpoint: string): Promise<LocalRuntimeStatus> {
		const cliAvailable = await this.commandAvailable('lms');
		const root = trimEndpoint(endpoint).replace(/\/v1$/, '');
		try {
			const response = await fetch(`${root}/v1/models`, { signal: AbortSignal.timeout(3000) });
			if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
			const data = await response.json() as { data?: Array<{ id?: string }> };
			const models: LocalModelInfo[] = (data.data ?? []).filter(model => !!model.id).map(model => ({ id: model.id! }));
			return { runtime: 'lmStudio', available: true, cliAvailable, endpoint, models };
		} catch (error) {
			return { runtime: 'lmStudio', available: false, cliAvailable, endpoint, models: [], error: errorMessage(error) };
		}
	}

	private async llamaCppStatus(endpoint: string): Promise<LocalRuntimeStatus> {
		const cliAvailable = await this.commandAvailable('llama-server', ['--help']);
		const root = trimEndpoint(endpoint).replace(/\/v1$/, '');
		try {
			const response = await fetch(`${root}/v1/models`, { signal: AbortSignal.timeout(3000) });
			if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
			const data = await response.json() as { data?: Array<{ id?: string }> };
			const models: LocalModelInfo[] = (data.data ?? []).filter(model => !!model.id).map(model => ({ id: model.id! }));
			return { runtime: 'llamaCpp', available: true, cliAvailable, endpoint, models };
		} catch (error) {
			return { runtime: 'llamaCpp', available: false, cliAvailable, endpoint, models: [], error: errorMessage(error) };
		}
	}

	async getState(ollamaEndpoint: string, lmStudioEndpoint: string, llamaCppEndpoint: string): Promise<LocalModelManagerState> {
		await fs.mkdir(this.modelDirectory, { recursive: true });
		const [acceleration, ollama, lmStudio, llamaCpp] = await Promise.all([
			this.acceleration(), this.ollamaStatus(ollamaEndpoint), this.lmStudioStatus(lmStudioEndpoint), this.llamaCppStatus(llamaCppEndpoint)
		]);
		return { acceleration, runtimes: [ollama, lmStudio, llamaCpp], modelDirectory: this.modelDirectory };
	}

	private beginOperation(): AbortController {
		if (this.activeAbortController || this.activeProcess) { throw new Error('Another model operation is already running.'); }
		this.activeAbortController = new AbortController();
		return this.activeAbortController;
	}

	private endOperation(): void {
		this.activeAbortController = undefined;
		this.activeProcess = undefined;
	}

	async pullOllamaModel(endpoint: string, model: string): Promise<void> {
		const normalizedModel = model.trim();
		if (!normalizedModel || !/^[a-zA-Z0-9._:/-]+$/.test(normalizedModel)) { throw new Error('Enter a valid Ollama model name, for example qwen2.5-coder:7b.'); }
		const controller = this.beginOperation();
		try {
			const response = await fetch(`${trimEndpoint(endpoint)}/api/pull`, {
				method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: normalizedModel, stream: true }), signal: controller.signal
			});
			if (!response.ok || !response.body) { throw new Error(`Ollama pull failed: HTTP ${response.status} ${await response.text()}`); }
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let pending = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) { break; }
				pending += decoder.decode(value, { stream: true });
				const lines = pending.split('\n');
				pending = lines.pop() ?? '';
				for (const line of lines) {
					if (!line.trim()) { continue; }
					const update = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string };
					if (update.error) { throw new Error(update.error); }
					this.progressEmitter.fire({ kind: 'ollama-pull', status: update.status ?? 'Downloading', completed: update.completed, total: update.total });
				}
			}
		} finally { this.endOperation(); }
	}

	private async runCLI(command: string, args: readonly string[], kind: LocalModelOperationProgress['kind'], env?: NodeJS.ProcessEnv): Promise<void> {
		const controller = this.beginOperation();
		try {
			await new Promise<void>((resolve, reject) => {
				const child = spawn(command, [...args], { windowsHide: true, env: env ?? process.env });
				this.activeProcess = child;
				let output = '';
				const handle = (data: Buffer) => {
					const text = data.toString();
					output = (output + text).slice(-8000);
					const lastLine = text.trim().split(/\r?\n/).pop();
					if (lastLine) { this.progressEmitter.fire({ kind, status: lastLine }); }
				};
				child.stdout?.on('data', handle);
				child.stderr?.on('data', handle);
				child.once('error', reject);
				child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}. ${output.trim()}`)));
				controller.signal.addEventListener('abort', () => { child.kill(); reject(new Error('Model operation cancelled.')); }, { once: true });
			});
		} finally { this.endOperation(); }
	}

	async downloadLMStudioModel(model: string, format: LocalModelFormat): Promise<void> {
		const normalizedModel = model.trim();
		if (!normalizedModel || normalizedModel.startsWith('-')) { throw new Error('Enter an LM Studio model search name or exact model key.'); }
		await this.runCLI('lms', ['get', normalizedModel, format === 'mlx' ? '--mlx' : '--gguf'], 'lmstudio-download');
	}

	async loadLMStudioModel(model: string): Promise<void> {
		const normalizedModel = model.trim();
		if (!normalizedModel || normalizedModel.startsWith('-')) { throw new Error('Enter the exact LM Studio model key to load.'); }
		await this.runCLI('lms', ['load', normalizedModel, '--gpu', 'max', '--yes'], 'lmstudio-load');
		await this.runCLI('lms', ['server', 'start'], 'lmstudio-load');
	}

	async downloadAndImportGGUF(url: string, modelName: string, runtime: LocalModelRuntime, ollamaEndpoint: string): Promise<void> {
		const parsedURL = new URL(url.trim());
		if (!['https:', 'http:'].includes(parsedURL.protocol)) { throw new Error('GGUF downloads require an HTTP or HTTPS URL.'); }
		if (!parsedURL.pathname.toLowerCase().endsWith('.gguf')) { throw new Error('The URL must point to a .gguf file.'); }
		const safeModelName = modelName.trim();
		if (!safeModelName || !/^[a-zA-Z0-9._:/-]+$/.test(safeModelName)) { throw new Error('Enter a safe model name using letters, numbers, dots, dashes, slashes, or colons.'); }
		const controller = this.beginOperation();
		let targetPath = '';
		try {
			await fs.mkdir(this.modelDirectory, { recursive: true });
			const safeFileName = basename(decodeURIComponent(parsedURL.pathname)).replace(/[^a-zA-Z0-9._-]/g, '_');
			targetPath = join(this.modelDirectory, safeFileName);
			const response = await fetch(parsedURL, { redirect: 'follow', signal: controller.signal });
			if (!response.ok || !response.body) { throw new Error(`GGUF download failed: HTTP ${response.status}`); }
			const total = Number(response.headers.get('content-length')) || undefined;
			const file = await fs.open(targetPath, 'w');
			let completed = 0;
			try {
				const reader = response.body.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) { break; }
					await file.write(value);
					completed += value.byteLength;
					this.progressEmitter.fire({ kind: 'gguf-download', status: `Downloading ${safeFileName}`, completed, total });
				}
			} finally { await file.close(); }
		} catch (error) {
			if (targetPath) { await fs.rm(targetPath, { force: true }); }
			throw error;
		} finally { this.endOperation(); }

		if (runtime === 'llamaCpp') {
			this.progressEmitter.fire({ kind: 'gguf-import', status: `Saved GGUF for llama.cpp: ${targetPath}` });
			return;
		}

		this.progressEmitter.fire({ kind: 'gguf-import', status: `Importing into ${runtime === 'ollama' ? 'Ollama' : 'LM Studio'}` });
		if (runtime === 'lmStudio') {
			await this.runCLI('lms', ['import', targetPath, '--copy', '--yes', '--user-repo', `axiom/${safeModelName.replace(/[/:]/g, '-')}`], 'gguf-import');
			return;
		}
		const modelfile = join(this.modelDirectory, `${safeModelName.replace(/[^a-zA-Z0-9._-]/g, '_')}.Modelfile`);
		const modelfilePath = targetPath.replace(/\\/g, '/').replace(/"/g, '\\"');
		await fs.writeFile(modelfile, `FROM "${modelfilePath}"\n`, 'utf8');
		await this.runCLI('ollama', ['create', safeModelName, '-f', modelfile], 'gguf-import', { ...process.env, OLLAMA_HOST: trimEndpoint(ollamaEndpoint) });
	}

	private parseLoopbackEndpoint(endpoint: string): { root: string; port: string } {
		const parsed = new URL(trimEndpoint(endpoint));
		if (!['http:', 'https:'].includes(parsed.protocol)) { throw new Error('llama.cpp endpoint must be HTTP or HTTPS.'); }
		if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) { throw new Error('Axiom only auto-starts llama.cpp on localhost.'); }
		const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
		if (!/^\d{2,5}$/.test(port)) { throw new Error('Enter a valid llama.cpp port.'); }
		return { root: `${parsed.protocol}//${parsed.host}`, port };
	}

	private async waitForLlamaServer(root: string, modelName: string): Promise<void> {
		const started = Date.now();
		let lastError = '';
		while (Date.now() - started < 30_000) {
			try {
				const response = await fetch(`${root}/v1/models`, { signal: AbortSignal.timeout(1500) });
				if (response.ok) {
					this.progressEmitter.fire({ kind: 'llamacpp-start', status: `${modelName} is serving at ${root}/v1` });
					return;
				}
				lastError = `HTTP ${response.status}`;
			} catch (error) {
				lastError = errorMessage(error);
			}
			await new Promise(resolve => setTimeout(resolve, 750));
		}
		throw new Error(`llama-server did not become ready: ${lastError}`);
	}

	async startLlamaCppModel(endpoint: string, modelPath: string, modelName: string): Promise<void> {
		const safeModelName = modelName.trim();
		if (!safeModelName || !/^[a-zA-Z0-9._:/-]+$/.test(safeModelName)) { throw new Error('Enter a safe llama.cpp model name using letters, numbers, dots, dashes, slashes, or colons.'); }
		const { root, port } = this.parseLoopbackEndpoint(endpoint);
		const resolvedModelPath = resolve(modelPath.trim());
		if (!resolvedModelPath.toLowerCase().endsWith('.gguf')) { throw new Error('llama.cpp requires a local .gguf model file.'); }
		const stat = await fs.stat(resolvedModelPath);
		if (!stat.isFile()) { throw new Error('The GGUF path must point to a file.'); }
		if (stat.size < 1024 * 1024) { throw new Error('The GGUF file is unexpectedly small. Check the download before loading it.'); }
		const controller = this.beginOperation();
		try {
			this.llamaServerProcess?.kill();
			this.progressEmitter.fire({ kind: 'llamacpp-start', status: `Starting llama-server for ${safeModelName}` });
			const args = ['-m', resolvedModelPath, '--host', '127.0.0.1', '--port', port, '--alias', safeModelName];
			const child = spawn('llama-server', args, { windowsHide: true, stdio: 'pipe' });
			this.llamaServerProcess = child;
			this.activeProcess = child;
			let output = '';
			const handle = (data: Buffer) => {
				const text = data.toString();
				output = (output + text).slice(-8000);
				const lastLine = text.trim().split(/\r?\n/).pop();
				if (lastLine) { this.progressEmitter.fire({ kind: 'llamacpp-start', status: lastLine }); }
			};
			child.stdout?.on('data', handle);
			child.stderr?.on('data', handle);
			child.once('error', error => {
				this.progressEmitter.fire({ kind: 'llamacpp-start', status: errorMessage(error) });
			});
			child.once('exit', code => {
				if (this.llamaServerProcess === child) { this.llamaServerProcess = undefined; }
				if (code !== 0 && this.activeProcess === child) { this.progressEmitter.fire({ kind: 'llamacpp-start', status: `llama-server exited with code ${code}. ${output.trim()}` }); }
			});
			controller.signal.addEventListener('abort', () => child.kill(), { once: true });
			await this.waitForLlamaServer(root, safeModelName);
		} finally {
			this.activeAbortController = undefined;
			this.activeProcess = undefined;
		}
	}

	async cancelActiveOperation(): Promise<void> {
		this.activeAbortController?.abort();
		this.activeProcess?.kill();
	}

	override dispose(): void {
		this.activeAbortController?.abort();
		this.activeProcess?.kill();
		this.llamaServerProcess?.kill();
		super.dispose();
	}
}
