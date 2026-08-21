/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';
import { IMetricsService } from '../common/metricsService.js';

const os = isWindows ? 'windows' : isMacintosh ? 'mac' : isLinux ? 'linux' : 'unknown';

/**
 * Community builds intentionally keep the inherited metrics API as a no-op. This lets
 * existing feature code call `capture` without sending usage or machine identifiers to
 * infrastructure controlled by the discontinued upstream project.
 */
export class MetricsMainService extends Disposable implements IMetricsService {
	_serviceBrand: undefined;

	private _debuggingProperties: object = { telemetry: 'disabled' };

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IApplicationStorageMainService private readonly _appStorage: IApplicationStorageMainService,
	) {
		super();
		this.initialize();
	}

	private async initialize(): Promise<void> {
		await this._appStorage.whenReady;
		const { commit, version, axiomVersion, quality } = this._productService;
		const { platform, arch } = process;
		this._debuggingProperties = {
			telemetry: 'disabled',
			commit,
			vscodeVersion: version,
			axiomVersion,
			quality,
			os,
			platform,
			arch,
			isDevMode: !this._envMainService.isBuilt,
		};
	}

	capture: IMetricsService['capture'] = () => { };

	setOptOut: IMetricsService['setOptOut'] = () => { };

	async getDebuggingProperties(): Promise<object> {
		return this._debuggingProperties;
	}
}
