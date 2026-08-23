/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export type LocalModelRuntime = 'ollama' | 'lmStudio' | 'llamaCpp';
export type LocalModelFormat = 'gguf' | 'mlx';

export interface LocalModelInfo {
	readonly id: string;
	readonly size?: number;
	readonly format?: string;
	readonly quantization?: string;
}

export interface LocalRuntimeStatus {
	readonly runtime: LocalModelRuntime;
	readonly available: boolean;
	readonly cliAvailable: boolean;
	readonly endpoint: string;
	readonly error?: string;
	readonly models: readonly LocalModelInfo[];
}

export interface LocalAccelerationInfo {
	readonly backend: 'CUDA' | 'MLX' | 'Metal' | 'ROCm' | 'Vulkan' | 'CPU';
	readonly detail: string;
	readonly platform: string;
	readonly architecture: string;
}

export interface LocalModelManagerState {
	readonly acceleration: LocalAccelerationInfo;
	readonly runtimes: readonly LocalRuntimeStatus[];
	readonly modelDirectory: string;
}

export interface LocalModelOperationProgress {
	readonly kind: 'ollama-pull' | 'lmstudio-download' | 'lmstudio-load' | 'gguf-download' | 'gguf-import' | 'llamacpp-start';
	readonly status: string;
	readonly completed?: number;
	readonly total?: number;
}

export interface ILocalModelService {
	readonly _serviceBrand: undefined;
	readonly onDidProgress: Event<LocalModelOperationProgress>;
	getState(ollamaEndpoint: string, lmStudioEndpoint: string, llamaCppEndpoint: string): Promise<LocalModelManagerState>;
	pullOllamaModel(endpoint: string, model: string): Promise<void>;
	downloadLMStudioModel(model: string, format: LocalModelFormat): Promise<void>;
	loadLMStudioModel(model: string): Promise<void>;
	downloadAndImportGGUF(url: string, modelName: string, runtime: LocalModelRuntime, ollamaEndpoint: string): Promise<void>;
	startLlamaCppModel(endpoint: string, modelPath: string, modelName: string): Promise<void>;
	cancelActiveOperation(): Promise<void>;
}

export const ILocalModelService = createDecorator<ILocalModelService>('LocalModelService');

class LocalModelService implements ILocalModelService {
	readonly _serviceBrand: undefined;
	private readonly service: ILocalModelService;
	readonly onDidProgress: Event<LocalModelOperationProgress>;

	constructor(@IMainProcessService mainProcessService: IMainProcessService) {
		this.service = ProxyChannel.toService<ILocalModelService>(mainProcessService.getChannel('axiom-channel-localModels'));
		this.onDidProgress = this.service.onDidProgress;
	}

	getState = (ollamaEndpoint: string, lmStudioEndpoint: string, llamaCppEndpoint: string) => this.service.getState(ollamaEndpoint, lmStudioEndpoint, llamaCppEndpoint);
	pullOllamaModel = (endpoint: string, model: string) => this.service.pullOllamaModel(endpoint, model);
	downloadLMStudioModel = (model: string, format: LocalModelFormat) => this.service.downloadLMStudioModel(model, format);
	loadLMStudioModel = (model: string) => this.service.loadLMStudioModel(model);
	downloadAndImportGGUF = (url: string, modelName: string, runtime: LocalModelRuntime, ollamaEndpoint: string) => this.service.downloadAndImportGGUF(url, modelName, runtime, ollamaEndpoint);
	startLlamaCppModel = (endpoint: string, modelPath: string, modelName: string) => this.service.startLlamaCppModel(endpoint, modelPath, modelName);
	cancelActiveOperation = () => this.service.cancelActiveOperation();
}

registerSingleton(ILocalModelService, LocalModelService, InstantiationType.Eager);
