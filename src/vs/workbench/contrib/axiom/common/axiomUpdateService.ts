/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { AxiomCheckUpdateResponse } from './axiomUpdateServiceTypes.js';



export interface IAxiomUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<AxiomCheckUpdateResponse>;
}


export const IAxiomUpdateService = createDecorator<IAxiomUpdateService>('AxiomUpdateService');


// implemented by calling channel
export class AxiomUpdateService implements IAxiomUpdateService {

	readonly _serviceBrand: undefined;
	private readonly axiomUpdateService: IAxiomUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.axiomUpdateService = ProxyChannel.toService<IAxiomUpdateService>(mainProcessService.getChannel('axiom-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IAxiomUpdateService['check'] = async (explicit) => {
		const res = await this.axiomUpdateService.check(explicit)
		return res
	}
}

registerSingleton(IAxiomUpdateService, AxiomUpdateService, InstantiationType.Eager);


