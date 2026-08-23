/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Cpu, Download, Loader2, RefreshCw, Square, X } from 'lucide-react';
import { LocalModelFormat, LocalModelManagerState, LocalModelOperationProgress, LocalModelRuntime } from '../../../../common/localModelService.js';
import { AxiomButtonBgDarken, AxiomSimpleInputBox } from '../util/inputs.js';
import { useAccessor, useSettingsState } from '../util/services.js';

const bytes = (value?: number) => {
	if (value === undefined) { return ''; }
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = value;
	let unit = 0;
	while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
	return `${size.toFixed(unit < 2 ? 0 : 1)} ${units[unit]}`;
};

const runtimeTitle = (runtime: LocalModelRuntime) => runtime === 'ollama' ? 'Ollama' : runtime === 'lmStudio' ? 'LM Studio' : 'llama.cpp';

const RuntimeCard = ({ state, onUse }: { state: LocalModelManagerState['runtimes'][number]; onUse: (model: string) => void }) => (
	<div className='border border-axiom-border-2 bg-axiom-bg-1 rounded p-3 min-w-0'>
		<div className='flex items-center justify-between gap-3'>
			<div className='font-medium'>{runtimeTitle(state.runtime)}</div>
			<span className={`text-xs ${state.available ? 'text-green-500' : 'text-axiom-fg-3'}`}>
				{state.available ? 'Server online' : state.cliAvailable ? 'CLI installed' : 'Not detected'}
			</span>
		</div>
		<div className='text-xs text-axiom-fg-3 mt-1 truncate' title={state.endpoint}>{state.endpoint}</div>
		<div className='mt-3 flex flex-col gap-1 max-h-36 overflow-y-auto'>
			{state.models.length ? state.models.map(model => (
				<div key={model.id} className='flex items-center justify-between gap-3 text-xs bg-axiom-bg-2 rounded px-2 py-1'>
					<span className='truncate' title={model.id}>{model.id}</span>
					<div className='flex items-center gap-2 whitespace-nowrap'><span className='text-axiom-fg-3'>{[model.quantization, bytes(model.size)].filter(Boolean).join(' · ')}</span><button className='text-[#0e70c0] hover:underline' onClick={() => onUse(model.id)}>Use for Chat</button></div>
				</div>
			)) : <div className='text-xs text-axiom-fg-3'>{state.error ?? 'No models reported by this server.'}</div>}
		</div>
	</div>
);

export const LocalModelCenter = () => {
	const accessor = useAccessor();
	const service = accessor.get('ILocalModelService');
	const refreshService = accessor.get('IRefreshModelService');
	const settingsService = accessor.get('IAxiomSettingsService');
	const settings = useSettingsState();
	const ollamaEndpoint = settings.settingsOfProvider.ollama.endpoint;
	const lmStudioEndpoint = settings.settingsOfProvider.lmStudio.endpoint;
	const llamaCppEndpoint = settings.settingsOfProvider.llamaCpp.endpoint;
	const [state, setState] = useState<LocalModelManagerState>();
	const [loadingState, setLoadingState] = useState(true);
	const [operation, setOperation] = useState<LocalModelOperationProgress>();
	const [error, setError] = useState<string>();
	const [success, setSuccess] = useState<string>();
	const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:7b');
	const [lmModel, setLMModel] = useState('qwen2.5-coder-7b-instruct@q4_k_m');
	const [lmFormat, setLMFormat] = useState<LocalModelFormat>('gguf');
	const [ggufURL, setGGUFURL] = useState('');
	const [ggufName, setGGUFName] = useState('my-model');
	const [ggufRuntime, setGGUFRuntime] = useState<LocalModelRuntime>('ollama');
	const [llamaCppPath, setLlamaCppPath] = useState('');
	const [llamaCppName, setLlamaCppName] = useState('local-gguf');

	const refresh = useCallback(async () => {
		setLoadingState(true);
		try { setState(await service.getState(ollamaEndpoint, lmStudioEndpoint, llamaCppEndpoint)); setError(undefined); }
		catch (err) { setError(err instanceof Error ? err.message : String(err)); }
		finally { setLoadingState(false); }
	}, [service, ollamaEndpoint, lmStudioEndpoint, llamaCppEndpoint]);

	useEffect(() => { void refresh(); }, [refresh]);
	useEffect(() => {
		const disposable = service.onDidProgress(progress => setOperation(progress));
		return () => disposable.dispose();
	}, [service]);

	const run = useCallback(async (label: string, provider: LocalModelRuntime, fn: () => Promise<void>) => {
		setError(undefined); setSuccess(undefined);
		setOperation({ kind: provider === 'ollama' ? 'ollama-pull' : provider === 'llamaCpp' ? 'llamacpp-start' : 'lmstudio-download', status: 'Starting...' });
		try {
			await fn();
			setSuccess(`${label} is ready to use.`);
			refreshService.startRefreshingModels(provider, { enableProviderOnSuccess: true, doNotFire: false });
			await refresh();
		} catch (err) { setError(err instanceof Error ? err.message : String(err)); }
		finally { setOperation(undefined); }
	}, [refresh, refreshService]);

	const operationPercent = useMemo(() => operation?.total && operation.completed !== undefined
		? Math.min(100, Math.round(operation.completed / operation.total * 100)) : undefined, [operation]);
	const selectedRuntime = state?.runtimes.find(runtime => runtime.runtime === ggufRuntime);
	const useForChat = useCallback((runtime: LocalModelRuntime, model: string) => {
		void settingsService.setModelSelectionOfFeature('Chat', { providerName: runtime, modelName: model });
		setSuccess(`${model} is now the Chat model.`);
	}, [settingsService]);

	return <div className='border border-axiom-border-2 bg-axiom-bg-2/30 rounded-md p-4 mb-6'>
		<div className='flex items-start justify-between gap-4'>
			<div>
				<h3 className='text-lg font-medium'>Local Model Center</h3>
				<p className='text-sm text-axiom-fg-3 mt-1'>Download and run real local models through Ollama, LM Studio, or llama.cpp. Models stay on your machine.</p>
			</div>
			<button className='p-1.5 rounded hover:bg-axiom-bg-2' disabled={loadingState || !!operation} onClick={() => void refresh()} title='Detect runtimes again'>
				<RefreshCw className={`size-4 ${loadingState ? 'animate-spin' : ''}`} />
			</button>
		</div>

		{state && <>
			<div className='flex gap-3 items-start border border-axiom-border-2 bg-axiom-bg-1 rounded p-3 my-4'>
				<Cpu className='size-5 mt-0.5 text-[#0e70c0] shrink-0' />
				<div><div className='font-medium'>{state.acceleration.backend} recommended</div><div className='text-xs text-axiom-fg-3 mt-1'>{state.acceleration.detail}</div></div>
			</div>
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5'>{state.runtimes.map(runtime => <RuntimeCard key={runtime.runtime} state={runtime} onUse={model => useForChat(runtime.runtime, model)} />)}</div>
		</>}

		<div className='flex flex-col gap-5'>
			<div>
				<div className='text-sm font-medium mb-2'>Ollama model library</div>
				<div className='flex flex-col sm:flex-row gap-2'>
					<AxiomSimpleInputBox value={ollamaModel} onChangeValue={setOllamaModel} placeholder='qwen2.5-coder:7b' disabled={!!operation} className='flex-1' />
					<AxiomButtonBgDarken disabled={!!operation || !state?.runtimes.find(r => r.runtime === 'ollama')?.available} onClick={() => void run(ollamaModel, 'ollama', () => service.pullOllamaModel(ollamaEndpoint, ollamaModel))}>
						<Download className='size-3.5 mr-2' /> Pull model
					</AxiomButtonBgDarken>
				</div>
			</div>

			<div>
				<div className='text-sm font-medium mb-2'>LM Studio model catalog</div>
				<div className='text-xs text-axiom-fg-3 mb-2'>Add a quantization such as <span className='font-mono'>@q4_k_m</span> for a non-interactive exact download.</div>
				<div className='flex flex-col sm:flex-row gap-2'>
					<AxiomSimpleInputBox value={lmModel} onChangeValue={setLMModel} placeholder='Model search or exact key' disabled={!!operation} className='flex-1' />
					<select className='bg-axiom-bg-1 border border-axiom-border-2 rounded px-2 text-xs' value={lmFormat} disabled={!!operation} onChange={event => setLMFormat(event.target.value as LocalModelFormat)}>
						<option value='gguf'>GGUF</option>
						<option value='mlx' disabled={state?.acceleration.backend !== 'MLX'}>MLX (Apple Silicon)</option>
					</select>
					<AxiomButtonBgDarken disabled={!!operation || !state?.runtimes.find(r => r.runtime === 'lmStudio')?.cliAvailable} onClick={() => void run(lmModel, 'lmStudio', () => service.downloadLMStudioModel(lmModel, lmFormat))}>
						<Download className='size-3.5 mr-2' /> Download
					</AxiomButtonBgDarken>
					<AxiomButtonBgDarken disabled={!!operation || !state?.runtimes.find(r => r.runtime === 'lmStudio')?.cliAvailable} onClick={() => void run(lmModel, 'lmStudio', () => service.loadLMStudioModel(lmModel))}>
						<Cpu className='size-3.5 mr-2' /> Load (max GPU)
					</AxiomButtonBgDarken>
				</div>
			</div>

			<div>
				<div className='text-sm font-medium mb-2'>llama.cpp GGUF runtime</div>
				<div className='text-xs text-axiom-fg-3 mb-2'>Install llama.cpp, then point Axiom at a local .gguf file. Axiom starts <span className='font-mono'>llama-server</span> on localhost and exposes it in model selectors.</div>
				<div className='grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 mb-2'>
					<AxiomSimpleInputBox value={llamaCppPath} onChangeValue={setLlamaCppPath} placeholder='C:\\Models\\qwen2.5-coder.Q4_K_M.gguf' disabled={!!operation} />
					<AxiomSimpleInputBox value={llamaCppName} onChangeValue={setLlamaCppName} placeholder='Model alias' disabled={!!operation} />
				</div>
				<AxiomButtonBgDarken disabled={!!operation || !llamaCppPath || !state?.runtimes.find(r => r.runtime === 'llamaCpp')?.cliAvailable} onClick={() => void run(llamaCppName, 'llamaCpp', () => service.startLlamaCppModel(llamaCppEndpoint, llamaCppPath, llamaCppName))}>
					<Cpu className='size-3.5 mr-2' /> Start llama-server
				</AxiomButtonBgDarken>
			</div>

			<div>
				<div className='text-sm font-medium mb-2'>Import any GGUF URL</div>
				<div className='grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 mb-2'>
					<AxiomSimpleInputBox value={ggufURL} onChangeValue={setGGUFURL} placeholder='https://…/model.Q4_K_M.gguf' disabled={!!operation} />
					<AxiomSimpleInputBox value={ggufName} onChangeValue={setGGUFName} placeholder='Model name' disabled={!!operation} />
				</div>
				<div className='flex gap-2'>
					<select className='bg-axiom-bg-1 border border-axiom-border-2 rounded px-2 text-xs flex-1' value={ggufRuntime} disabled={!!operation} onChange={event => setGGUFRuntime(event.target.value as LocalModelRuntime)}>
						<option value='ollama'>Import into Ollama</option><option value='lmStudio'>Import into LM Studio</option><option value='llamaCpp'>Save for llama.cpp</option>
					</select>
					<AxiomButtonBgDarken disabled={!!operation || !ggufURL || !selectedRuntime?.cliAvailable} onClick={() => void run(ggufName, ggufRuntime, () => service.downloadAndImportGGUF(ggufURL, ggufName, ggufRuntime, ollamaEndpoint))}>
						<Download className='size-3.5 mr-2' /> Download & import
					</AxiomButtonBgDarken>
				</div>
				{state && <div className='text-xs text-axiom-fg-3 mt-2'>Managed downloads: {state.modelDirectory}</div>}
			</div>

			<div className='border border-axiom-border-2 bg-axiom-bg-1 rounded p-3'>
				<div className='text-sm font-medium mb-2'>Hermes Agent setup</div>
				<div className='text-xs text-axiom-fg-3'>Install Hermes Agent, then run <span className='font-mono'>hermes setup</span>, <span className='font-mono'>hermes model</span>, and <span className='font-mono'>hermes tools</span>. For local inference, choose an OpenAI-compatible provider and use Axiom's llama.cpp endpoint <span className='font-mono'>{llamaCppEndpoint.replace(/\/+$/, '')}/v1</span>.</div>
			</div>
		</div>

		{operation && <div className='mt-4 border border-axiom-border-2 bg-axiom-bg-1 rounded p-3'>
			<div className='flex items-center gap-2'><Loader2 className='size-4 animate-spin' /><span className='text-sm flex-1 truncate'>{operation.status}</span><button onClick={() => void service.cancelActiveOperation()} title='Cancel'><Square className='size-3.5' /></button></div>
			{operationPercent !== undefined && <div className='mt-2'><div className='h-1.5 bg-axiom-bg-2 rounded overflow-hidden'><div className='h-full bg-[#0e70c0]' style={{ width: `${operationPercent}%` }} /></div><div className='text-xs text-axiom-fg-3 mt-1'>{operationPercent}% · {bytes(operation.completed)} / {bytes(operation.total)}</div></div>}
		</div>}
		{error && <div className='mt-4 flex gap-2 text-sm text-red-500'><X className='size-4 shrink-0 mt-0.5' />{error}</div>}
		{success && <div className='mt-4 flex gap-2 text-sm text-green-500'><Check className='size-4 shrink-0 mt-0.5' />{success}</div>}
	</div>;
};
