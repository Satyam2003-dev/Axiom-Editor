/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Axiom Editor contributors. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.dirname(__dirname);
const source = path.join(root, 'resources', 'branding', 'axiom-master.png');

function target(relativePath) {
	return path.join(root, ...relativePath.split('/'));
}

async function squarePng(trimmed, size, background) {
	const innerSize = Math.round(size * 0.9);
	let image = sharp(trimmed).resize({ width: innerSize, height: innerSize, fit: 'inside' });
	if (background) {
		image = image.flatten({ background });
	}
	const resized = await image.png().toBuffer({ resolveWithObject: true });
	const left = Math.floor((size - resized.info.width) / 2);
	const right = size - resized.info.width - left;
	const top = Math.floor((size - resized.info.height) / 2);
	const bottom = size - resized.info.height - top;
	return sharp(resized.data).extend({
		top,
		bottom,
		left,
		right,
		background: background ?? { r: 0, g: 0, b: 0, alpha: 0 }
	}).png().toBuffer();
}

function createIco(images) {
	const directorySize = 6 + images.length * 16;
	const header = Buffer.alloc(directorySize);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);
	let offset = directorySize;
	images.forEach(({ size, data }, index) => {
		const entry = 6 + index * 16;
		header.writeUInt8(size === 256 ? 0 : size, entry);
		header.writeUInt8(size === 256 ? 0 : size, entry + 1);
		header.writeUInt8(0, entry + 2);
		header.writeUInt8(0, entry + 3);
		header.writeUInt16LE(1, entry + 4);
		header.writeUInt16LE(32, entry + 6);
		header.writeUInt32LE(data.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);
		offset += data.length;
	});
	return Buffer.concat([header, ...images.map(image => image.data)]);
}

function createIcns(images) {
	const chunks = images.map(({ type, data }) => {
		const header = Buffer.alloc(8);
		header.write(type, 0, 4, 'ascii');
		header.writeUInt32BE(data.length + 8, 4);
		return Buffer.concat([header, data]);
	});
	const header = Buffer.alloc(8);
	header.write('icns', 0, 4, 'ascii');
	header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
	return Buffer.concat([header, ...chunks]);
}

function createBmp(rgb, width, height) {
	const rowSize = Math.ceil(width * 3 / 4) * 4;
	const pixelSize = rowSize * height;
	const output = Buffer.alloc(54 + pixelSize);
	output.write('BM', 0, 2, 'ascii');
	output.writeUInt32LE(output.length, 2);
	output.writeUInt32LE(54, 10);
	output.writeUInt32LE(40, 14);
	output.writeInt32LE(width, 18);
	output.writeInt32LE(height, 22);
	output.writeUInt16LE(1, 26);
	output.writeUInt16LE(24, 28);
	output.writeUInt32LE(pixelSize, 34);
	for (let y = 0; y < height; y++) {
		const inputRow = y * width * 3;
		const outputRow = 54 + (height - y - 1) * rowSize;
		for (let x = 0; x < width; x++) {
			const input = inputRow + x * 3;
			const outputPixel = outputRow + x * 3;
			output[outputPixel] = rgb[input + 2];
			output[outputPixel + 1] = rgb[input + 1];
			output[outputPixel + 2] = rgb[input];
		}
	}
	return output;
}

function createXpm(raw, width, height) {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
	const colors = new Map();
	const pixels = [];
	const colorKey = (r, g, b, alpha) => alpha < 32 ? 'none' : `${r >> 3},${g >> 3},${b >> 3}`;
	for (let index = 0; index < raw.length; index += 4) {
		const key = colorKey(raw[index], raw[index + 1], raw[index + 2], raw[index + 3]);
		if (!colors.has(key)) {
			colors.set(key, colors.size);
		}
		pixels.push(colors.get(key));
	}
	if (colors.size > alphabet.length ** 2) {
		throw new Error(`XPM palette has ${colors.size} colors; two-character codes support ${alphabet.length ** 2}.`);
	}
	const code = index => alphabet[Math.floor(index / alphabet.length)] + alphabet[index % alphabet.length];
	const definitions = [...colors.keys()].map((key, index) => {
		if (key === 'none') {
			return `"${code(index)} c None"`;
		}
		const [r, g, b] = key.split(',').map(Number);
		const channel = (value, levels) => Math.round(value * 255 / levels).toString(16).padStart(2, '0').toUpperCase();
		return `"${code(index)} c #${channel(r, 31)}${channel(g, 31)}${channel(b, 31)}"`;
	});
	const rows = [];
	for (let y = 0; y < height; y++) {
		rows.push(`"${pixels.slice(y * width, (y + 1) * width).map(code).join('')}"`);
	}
	return `/* XPM */\nstatic char * axiom_xpm[] = {\n"${width} ${height} ${colors.size} 2",\n${definitions.join(',\n')},\n${rows.join(',\n')}\n};\n`;
}

async function main() {
	if (!fs.existsSync(source)) {
		throw new Error(`Missing canonical logo: ${source}`);
	}
	const trimmed = await sharp(source).trim({
		background: { r: 0, g: 0, b: 0, alpha: 0 },
		threshold: 8
	}).png().toBuffer();

	const pngTargets = [
		['axiom_icons/logo_axiom.png', 1024],
		['axiom_icons/cubecircled.png', 512],
		['axiom_icons/logo_cube_noshadow.png', 512],
		['axiom_icons/slice_of_axiom.png', 512],
		['resources/linux/code.png', 512],
		['resources/server/code-512.png', 512],
		['resources/server/code-192.png', 192],
		['resources/win32/logo_cube_noshadow.png', 512],
		['resources/win32/code_150x150.png', 150],
		['resources/win32/code_70x70.png', 70],
		['src/vs/workbench/browser/media/axiom-icon-sm.png', 256]
	];
	for (const [relativePath, size] of pngTargets) {
		fs.writeFileSync(target(relativePath), await squarePng(trimmed, size));
	}

	const icoImages = [];
	for (const size of [16, 24, 32, 48, 64, 128, 256]) {
		icoImages.push({ size, data: await squarePng(trimmed, size) });
	}
	const ico = createIco(icoImages);
	for (const relativePath of ['axiom_icons/code.ico', 'resources/server/favicon.ico', 'resources/win32/code.ico']) {
		fs.writeFileSync(target(relativePath), ico);
	}

	const icnsTypes = [[16, 'icp4'], [32, 'icp5'], [64, 'icp6'], [128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']];
	const icnsImages = [];
	for (const [size, type] of icnsTypes) {
		icnsImages.push({ type, data: await squarePng(trimmed, size) });
	}
	fs.writeFileSync(target('resources/darwin/code.icns'), createIcns(icnsImages));

	const installerSize = 1200;
	const installerPng = await squarePng(trimmed, installerSize, { r: 0, g: 0, b: 0 });
	const installerRgb = await sharp(installerPng).removeAlpha().raw().toBuffer();
	fs.writeFileSync(target('resources/win32/inno-axiom.bmp'), createBmp(installerRgb, installerSize, installerSize));

	const xpmSize = 256;
	const xpmRaw = await sharp(await squarePng(trimmed, xpmSize)).raw().toBuffer();
	fs.writeFileSync(target('resources/linux/rpm/code.xpm'), createXpm(xpmRaw, xpmSize, xpmSize));

	console.log(`Generated Axiom branding assets from ${path.relative(root, source)}.`);
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
