(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["Gaussian Splat 3D"] = global["Gaussian Splat 3D"] || {}, global.THREE));
})(this, (function (exports, THREE) { 'use strict';

    function _interopNamespaceDefault(e) {
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n.default = e;
        return Object.freeze(n);
    }

    var THREE__namespace = /*#__PURE__*/_interopNamespaceDefault(THREE);

    const tempVector3A = new THREE__namespace.Vector3();
    const tempVector3B = new THREE__namespace.Vector3();
    const tempVector4A = new THREE__namespace.Vector4();
    const tempVector4B = new THREE__namespace.Vector4();
    const tempQuaternion4A = new THREE__namespace.Quaternion();
    const tempQuaternion4B = new THREE__namespace.Quaternion();

    let fbf;
    let tbf;

    class SplatBuffer {

        static CenterComponentCount = 3;
        static ScaleComponentCount = 3;
        static RotationComponentCount = 4;
        static ColorComponentCount = 4;

        static CompressionLevels = {
            0: {
                BytesPerCenter: 12,
                BytesPerScale: 12,
                BytesPerColor: 4,
                BytesPerRotation: 16,
                ScaleRange: 1
            },
            1: {
                BytesPerCenter: 6,
                BytesPerScale: 6,
                BytesPerColor: 4,
                BytesPerRotation: 8,
                ScaleRange: 32767
            }
        };

        static CovarianceSizeFloats = 6;
        static CovarianceSizeBytes = 24;

        static HeaderSizeBytes = 1024;

        constructor(bufferData) {
            this.headerBufferData = new ArrayBuffer(SplatBuffer.HeaderSizeBytes);
            this.headerArrayUint8 = new Uint8Array(this.headerBufferData);
            this.headerArrayUint32 = new Uint32Array(this.headerBufferData);
            this.headerArrayFloat32 = new Float32Array(this.headerBufferData);
            this.headerArrayUint8.set(new Uint8Array(bufferData, 0, SplatBuffer.HeaderSizeBytes));
            this.versionMajor = this.headerArrayUint8[0];
            this.versionMinor = this.headerArrayUint8[1];
            this.headerExtraK = this.headerArrayUint8[2];
            this.compressionLevel = this.headerArrayUint8[3];
            this.splatCount = this.headerArrayUint32[1];
            this.bucketSize = this.headerArrayUint32[2];
            this.bucketCount = this.headerArrayUint32[3];
            this.bucketBlockSize = this.headerArrayFloat32[4];
            this.halfBucketBlockSize = this.bucketBlockSize / 2.0;
            this.bytesPerBucket = this.headerArrayUint32[5];
            this.compressionScaleRange = this.headerArrayUint32[6] || SplatBuffer.CompressionLevels[this.compressionLevel].ScaleRange;
            this.compressionScaleFactor = this.halfBucketBlockSize / this.compressionScaleRange;

            const dataBufferSizeBytes = bufferData.byteLength - SplatBuffer.HeaderSizeBytes;
            this.splatBufferData = new ArrayBuffer(dataBufferSizeBytes);
            new Uint8Array(this.splatBufferData).set(new Uint8Array(bufferData, SplatBuffer.HeaderSizeBytes, dataBufferSizeBytes));

            this.bytesPerCenter = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerCenter;
            this.bytesPerScale = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerScale;
            this.bytesPerColor = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerColor;
            this.bytesPerRotation = SplatBuffer.CompressionLevels[this.compressionLevel].BytesPerRotation;

            this.bytesPerSplat = this.bytesPerCenter + this.bytesPerScale + this.bytesPerColor + this.bytesPerRotation;

            fbf = this.fbf.bind(this);
            tbf = this.tbf.bind(this);

            this.linkBufferArrays();
        }

        linkBufferArrays() {
            let FloatArray = (this.compressionLevel === 0) ? Float32Array : Uint16Array;
            this.centerArray = new FloatArray(this.splatBufferData, 0, this.splatCount * SplatBuffer.CenterComponentCount);
            this.scaleArray = new FloatArray(this.splatBufferData, this.bytesPerCenter * this.splatCount,
                                             this.splatCount * SplatBuffer.ScaleComponentCount);
            this.colorArray = new Uint8Array(this.splatBufferData, (this.bytesPerCenter + this.bytesPerScale) * this.splatCount,
                                             this.splatCount * SplatBuffer.ColorComponentCount);
            this.rotationArray = new FloatArray(this.splatBufferData,
                                                 (this.bytesPerCenter + this.bytesPerScale + this.bytesPerColor) * this.splatCount,
                                                  this.splatCount * SplatBuffer.RotationComponentCount);
            this.bucketsBase = this.splatCount * this.bytesPerSplat;
        }

        fbf(f) {
            if (this.compressionLevel === 0) {
                return f;
            } else {
                return THREE__namespace.DataUtils.fromHalfFloat(f);
            }
        };

        tbf(f) {
            if (this.compressionLevel === 0) {
                return f;
            } else {
                return THREE__namespace.DataUtils.toHalfFloat(f);
            }
        };

        getHeaderBufferData() {
            return this.headerBufferData;
        }

        getSplatBufferData() {
            return this.splatBufferData;
        }

        getCenter(index, outCenter = new THREE__namespace.Vector3()) {
            let bucket = [0, 0, 0];
            const centerBase = index * SplatBuffer.CenterComponentCount;
            if (this.compressionLevel > 0) {
                const sf = this.compressionScaleFactor;
                const sr = this.compressionScaleRange;
                const bucketIndex = Math.floor(index / this.bucketSize);
                bucket = new Float32Array(this.splatBufferData, this.bucketsBase + bucketIndex * this.bytesPerBucket, 3);
                outCenter.x = (this.centerArray[centerBase] - sr) * sf + bucket[0];
                outCenter.y = (this.centerArray[centerBase + 1] - sr) * sf + bucket[1];
                outCenter.z = (this.centerArray[centerBase + 2] - sr) * sf + bucket[2];
            } else {
                outCenter.x = this.centerArray[centerBase];
                outCenter.y = this.centerArray[centerBase + 1];
                outCenter.z = this.centerArray[centerBase + 2];
            }
            return outCenter;
        }

        setCenter(index, center) {
            let bucket = [0, 0, 0];
            const centerBase = index * SplatBuffer.CenterComponentCount;
            if (this.compressionLevel > 0) {
                const sf = 1.0 / this.compressionScaleFactor;
                const sr = this.compressionScaleRange;
                const maxR = sr * 2 + 1;
                const bucketIndex = Math.floor(index / this.bucketSize);
                bucket = new Float32Array(this.splatBufferData, this.bucketsBase + bucketIndex * this.bytesPerBucket, 3);
                this.centerArray[centerBase] = clamp(Math.round((center.x - bucket[0]) * sf) + sr, 0, maxR);
                this.centerArray[centerBase + 1] = clamp(Math.round((center.y - bucket[1]) * sf) + sr, 0, maxR);
                this.centerArray[centerBase + 2] = clamp(Math.round((center.z - bucket[2]) * sf) + sr, 0, maxR);
            } else {
                this.centerArray[centerBase] = center.x;
                this.centerArray[centerBase + 1] = center.y;
                this.centerArray[centerBase + 2] = center.z;
            }
        }

        getScale(index, outScale = new THREE__namespace.Vector3()) {
            const scaleBase = index * SplatBuffer.ScaleComponentCount;
            outScale.set(fbf(this.scaleArray[scaleBase]), fbf(this.scaleArray[scaleBase + 1]), fbf(this.scaleArray[scaleBase + 2]));
            return outScale;
        }

        setScale(index, scale) {
            const scaleBase = index * SplatBuffer.ScaleComponentCount;
            this.scaleArray[scaleBase] = tbf(scale.x);
            this.scaleArray[scaleBase + 1] = tbf(scale.y);
            this.scaleArray[scaleBase + 2] = tbf(scale.z);
        }

        getRotation(index, outRotation = new THREE__namespace.Quaternion()) {
            const rotationBase = index * SplatBuffer.RotationComponentCount;
            outRotation.set(fbf(this.rotationArray[rotationBase + 1]), fbf(this.rotationArray[rotationBase + 2]),
                            fbf(this.rotationArray[rotationBase + 3]), fbf(this.rotationArray[rotationBase]));
            return outRotation;
        }

        setRotation(index, rotation) {
            const rotationBase = index * SplatBuffer.RotationComponentCount;
            this.rotationArray[rotationBase] = tbf(rotation.w);
            this.rotationArray[rotationBase + 1] = tbf(rotation.x);
            this.rotationArray[rotationBase + 2] = tbf(rotation.y);
            this.rotationArray[rotationBase + 3] = tbf(rotation.z);
        }

        getColor(index, outColor = new THREE__namespace.Vector4()) {
            const colorBase = index * SplatBuffer.ColorComponentCount;
            outColor.set(this.colorArray[colorBase], this.colorArray[colorBase + 1],
                         this.colorArray[colorBase + 2], this.colorArray[colorBase + 3]);
            return outColor;
        }

        setColor(index, color) {
            const colorBase = index * SplatBuffer.ColorComponentCount;
            this.colorArray[colorBase] = color.x;
            this.colorArray[colorBase + 1] = color.y;
            this.colorArray[colorBase + 2] = color.z;
            this.colorArray[colorBase + 3] = color.w;
        }

        getSplatCount() {
            return this.splatCount;
        }

        fillCovarianceArray(covarianceArray) {
            const splatCount = this.splatCount;

            const scale = new THREE__namespace.Vector3();
            const rotation = new THREE__namespace.Quaternion();
            const rotationMatrix = new THREE__namespace.Matrix3();
            const scaleMatrix = new THREE__namespace.Matrix3();
            const covarianceMatrix = new THREE__namespace.Matrix3();
            const tempMatrix4 = new THREE__namespace.Matrix4();

            for (let i = 0; i < splatCount; i++) {
                const scaleBase = i * SplatBuffer.ScaleComponentCount;
                scale.set(fbf(this.scaleArray[scaleBase]), fbf(this.scaleArray[scaleBase + 1]), fbf(this.scaleArray[scaleBase + 2]));
                tempMatrix4.makeScale(scale.x, scale.y, scale.z);
                scaleMatrix.setFromMatrix4(tempMatrix4);

                const rotationBase = i * SplatBuffer.RotationComponentCount;
                rotation.set(fbf(this.rotationArray[rotationBase + 1]),
                             fbf(this.rotationArray[rotationBase + 2]),
                             fbf(this.rotationArray[rotationBase + 3]),
                             fbf(this.rotationArray[rotationBase]));
                tempMatrix4.makeRotationFromQuaternion(rotation);
                rotationMatrix.setFromMatrix4(tempMatrix4);

                covarianceMatrix.copy(rotationMatrix).multiply(scaleMatrix);
                const M = covarianceMatrix.elements;
                covarianceArray[SplatBuffer.CovarianceSizeFloats * i] = M[0] * M[0] + M[3] * M[3] + M[6] * M[6];
                covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 1] = M[0] * M[1] + M[3] * M[4] + M[6] * M[7];
                covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 2] = M[0] * M[2] + M[3] * M[5] + M[6] * M[8];
                covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 3] = M[1] * M[1] + M[4] * M[4] + M[7] * M[7];
                covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 4] = M[1] * M[2] + M[4] * M[5] + M[7] * M[8];
                covarianceArray[SplatBuffer.CovarianceSizeFloats * i + 5] = M[2] * M[2] + M[5] * M[5] + M[8] * M[8];
            }
        }

        fillCenterArray(outCenterArray) {
            const splatCount = this.splatCount;
            let bucket = [0, 0, 0];
            for (let i = 0; i < splatCount; i++) {
                const centerBase = i * SplatBuffer.CenterComponentCount;
                if (this.compressionLevel > 0) {
                    const bucketIndex = Math.floor(i / this.bucketSize);
                    bucket = new Float32Array(this.splatBufferData, this.bucketsBase + bucketIndex * this.bytesPerBucket, 3);
                    const sf = this.compressionScaleFactor;
                    const sr = this.compressionScaleRange;
                    outCenterArray[centerBase] = (this.centerArray[centerBase] - sr) * sf + bucket[0];
                    outCenterArray[centerBase + 1] = (this.centerArray[centerBase + 1] - sr) * sf + bucket[1];
                    outCenterArray[centerBase + 2] = (this.centerArray[centerBase + 2] - sr) * sf + bucket[2];
                } else {
                    outCenterArray[centerBase] = this.centerArray[centerBase];
                    outCenterArray[centerBase + 1] = this.centerArray[centerBase + 1];
                    outCenterArray[centerBase + 2] = this.centerArray[centerBase + 2];
                }
            }
        }

        fillScaleArray(outScaleArray) {
            const fbf = this.fbf.bind(this);
            const splatCount = this.splatCount;
            for (let i = 0; i < splatCount; i++) {
                const scaleBase = i * SplatBuffer.ScaleComponentCount;
                outScaleArray[scaleBase] = fbf(this.scaleArray[scaleBase]);
                outScaleArray[scaleBase + 1] = fbf(this.scaleArray[scaleBase + 1]);
                outScaleArray[scaleBase + 2] = fbf(this.scaleArray[scaleBase + 2]);
            }
        }

        fillRotationArray(outRotationArray) {
            const fbf = this.fbf.bind(this);
            const splatCount = this.splatCount;
            for (let i = 0; i < splatCount; i++) {
                const rotationBase = i * SplatBuffer.RotationComponentCount;
                outRotationArray[rotationBase] = fbf(this.rotationArray[rotationBase]);
                outRotationArray[rotationBase + 1] = fbf(this.rotationArray[rotationBase + 1]);
                outRotationArray[rotationBase + 2] = fbf(this.rotationArray[rotationBase + 2]);
                outRotationArray[rotationBase + 3] = fbf(this.rotationArray[rotationBase + 3]);
            }
        }

        fillColorArray(outColorArray) {
            const splatCount = this.splatCount;
            for (let i = 0; i < splatCount; i++) {
                const colorBase = i * SplatBuffer.ColorComponentCount;
                outColorArray[colorBase] = this.colorArray[colorBase];
                outColorArray[colorBase + 1] = this.colorArray[colorBase + 1];
                outColorArray[colorBase + 2] = this.colorArray[colorBase + 2];
                outColorArray[colorBase + 3] = this.colorArray[colorBase + 3];
            }
        }

        swapVertices(indexA, indexB) {

            this.getCenter(indexA, tempVector3A);
            this.getCenter(indexB, tempVector3B);
            this.setCenter(indexB, tempVector3A);
            this.setCenter(indexA, tempVector3B);

            this.getScale(indexA, tempVector3A);
            this.getScale(indexB, tempVector3B);
            this.setScale(indexB, tempVector3A);
            this.setScale(indexA, tempVector3B);

            this.getRotation(indexA, tempQuaternion4A);
            this.getRotation(indexB, tempQuaternion4B);
            this.setRotation(indexB, tempQuaternion4A);
            this.setRotation(indexA, tempQuaternion4B);

            this.getColor(indexA, tempVector4A);
            this.getColor(indexB, tempVector4B);
            this.setColor(indexB, tempVector4A);
            this.setColor(indexA, tempVector4B);

        }

    }

    const floatToHalf = function() {

        const floatView = new Float32Array(1);
        const int32View = new Int32Array(floatView.buffer);

        return function(val) {
            floatView[0] = val;
            const x = int32View[0];

            let bits = (x >> 16) & 0x8000;
            let m = (x >> 12) & 0x07ff;
            const e = (x >> 23) & 0xff;

            if (e < 103) return bits;

            if (e > 142) {
                bits |= 0x7c00;
                bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
                return bits;
            }

            if (e < 113) {
                m |= 0x0800;
                bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
                return bits;
            }

            bits |= (( e - 112) << 10) | (m >> 1);
            bits += m & 1;
            return bits;
        };

    }();

    const uintEncodedFloat = function() {

        const floatView = new Float32Array(1);
        const int32View = new Int32Array(floatView.buffer);

        return function(f) {
            floatView[0] = f;
            return int32View[0];
        };

    }();

    const rgbaToInteger = function(r, g, b, a) {
        return r + (g << 8) + (b << 16) + (a << 24);
    };

    const fetchWithProgress = function(path, onProgress) {

        return new Promise((resolve, reject) => {
            fetch(path)
            .then(async (data) => {
                const reader = data.body.getReader();
                let bytesDownloaded = 0;
                let _fileSize = data.headers.get('Content-Length');
                let fileSize = _fileSize ? parseInt(_fileSize) : undefined;

                const chunks = [];

                while (true) {
                    try {
                        const { value: chunk, done } = await reader.read();
                        if (done) {
                            if (onProgress) {
                                onProgress(100, '100%', chunk);
                            }
                            const buffer = new Blob(chunks).arrayBuffer();
                            resolve(buffer);
                            break;
                        }
                        bytesDownloaded += chunk.length;
                        let percent;
                        let percentLabel;
                        if (fileSize !== undefined) {
                            percent = bytesDownloaded / fileSize * 100;
                            percentLabel = `${percent.toFixed(2)}%`;
                        }
                        chunks.push(chunk);
                        if (onProgress) {
                            onProgress(percent, percentLabel, chunk);
                        }
                    } catch (error) {
                        reject(error);
                        break;
                    }
                }
            });
        });

    };

    const clamp$1 = function(val, min, max) {
        return Math.max(Math.min(val, max), min);
    };

    const getCurrentTime = function() {
        return performance.now() / 1000;
    };

    const SplatBufferBucketSize = 256;
    const SplatBufferBucketBlockSize = 5.0;

    class PlyParser {

        constructor(plyBuffer) {
            this.plyBuffer = plyBuffer;
        }

        decodeHeader(plyBuffer) {
            const decoder = new TextDecoder();
            let headerOffset = 0;
            let headerText = '';

            console.log('.PLY size: ' + plyBuffer.byteLength + ' bytes');

            const readChunkSize = 100;

            while (true) {
                if (headerOffset + readChunkSize >= plyBuffer.byteLength) {
                    throw new Error('End of file reached while searching for end of header');
                }
                const headerChunk = new Uint8Array(plyBuffer, headerOffset, readChunkSize);
                headerText += decoder.decode(headerChunk);
                headerOffset += readChunkSize;

                const endHeaderTestChunk = new Uint8Array(plyBuffer, Math.max(0, headerOffset - readChunkSize * 2), readChunkSize * 2);
                const endHeaderTestText = decoder.decode(endHeaderTestChunk);
                if (endHeaderTestText.includes('end_header')) {
                    break;
                }
            }

            const headerLines = headerText.split('\n');

            let splatCount = 0;
            let propertyTypes = {};

            for (let i = 0; i < headerLines.length; i++) {
                const line = headerLines[i].trim();
                if (line.startsWith('element vertex')) {
                    const splatCountMatch = line.match(/\d+/);
                    if (splatCountMatch) {
                        splatCount = parseInt(splatCountMatch[0]);
                    }
                } else if (line.startsWith('property')) {
                    const propertyMatch = line.match(/(\w+)\s+(\w+)\s+(\w+)/);
                    if (propertyMatch) {
                        const propertyType = propertyMatch[2];
                        const propertyName = propertyMatch[3];
                        propertyTypes[propertyName] = propertyType;
                    }
                } else if (line === 'end_header') {
                    break;
                }
            }

            const vertexByteOffset = headerText.indexOf('end_header') + 'end_header'.length + 1;
            const vertexData = new DataView(plyBuffer, vertexByteOffset);

            return {
                'splatCount': splatCount,
                'propertyTypes': propertyTypes,
                'vertexData': vertexData,
                'headerOffset': headerOffset
            };
        }

        readRawVertexFast(vertexData, offset, fieldOffsets, propertiesToRead, propertyTypes, outVertex) {
            let rawVertex = outVertex || {};
            for (let property of propertiesToRead) {
                const propertyType = propertyTypes[property];
                if (propertyType === 'float') {
                    rawVertex[property] = vertexData.getFloat32(offset + fieldOffsets[property], true);
                } else if (propertyType === 'uchar') {
                    rawVertex[property] = vertexData.getUint8(offset + fieldOffsets[property]) / 255.0;
                }
            }
        }

        parseToSplatBuffer(compressionLevel = 0, minimumAlpha = 1) {

            const startTime = performance.now();

            console.log('Parsing PLY to SPLAT...');

            const {splatCount, propertyTypes, vertexData} = this.decodeHeader(this.plyBuffer);

            // figure out the SH degree from the number of coefficients
            let nRestCoeffs = 0;
            for (const propertyName in propertyTypes) {
                if (propertyName.startsWith('f_rest_')) {
                    nRestCoeffs += 1;
                }
            }
            const nCoeffsPerColor = nRestCoeffs / 3;

            // TODO: Eventually properly support multiple degree spherical harmonics
            // const sphericalHarmonicsDegree = Math.sqrt(nCoeffsPerColor + 1) - 1;
            const sphericalHarmonicsDegree = 0;

            console.log('Detected degree', sphericalHarmonicsDegree, 'with ', nCoeffsPerColor, 'coefficients per color');

            // figure out the order in which spherical harmonics should be read
            const shFeatureOrder = [];
            for (let rgb = 0; rgb < 3; ++rgb) {
                shFeatureOrder.push(`f_dc_${rgb}`);
            }
            for (let i = 0; i < nCoeffsPerColor; ++i) {
                for (let rgb = 0; rgb < 3; ++rgb) {
                    shFeatureOrder.push(`f_rest_${rgb * nCoeffsPerColor + i}`);
                }
            }

            let plyRowSize = 0;
            let fieldOffsets = {};
            const fieldSize = {
                'double': 8,
                'int': 4,
                'uint': 4,
                'float': 4,
                'short': 2,
                'ushort': 2,
                'uchar': 1,
            };
            for (let fieldName in propertyTypes) {
                if (propertyTypes.hasOwnProperty(fieldName)) {
                    const type = propertyTypes[fieldName];
                    fieldOffsets[fieldName] = plyRowSize;
                    plyRowSize += fieldSize[type];
                }
            }

            let rawVertex = {};

            const propertiesToRead = ['scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3',
                                      'x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity'];

            const validVertexes = [];
            // dummy vertex used for invalid vertexes
            const vertexZero = {};
            for (let propertyToRead of propertiesToRead) vertexZero[propertyToRead] = 0;
            validVertexes.push(vertexZero);
            for (let row = 0; row < splatCount; row++) {
                this.readRawVertexFast(vertexData, row * plyRowSize, fieldOffsets, propertiesToRead, propertyTypes, rawVertex);
                let alpha;
                if (propertyTypes['opacity']) {
                    alpha = (1 / (1 + Math.exp(-rawVertex.opacity))) * 255;
                } else {
                    alpha = 255;
                }
                if (alpha > minimumAlpha) {
                    const newVertex = {};
                    for (let propertyToRead of propertiesToRead) newVertex[propertyToRead] = rawVertex[propertyToRead];
                    validVertexes.push(newVertex);
                }
            }

            console.log('Total valid splats: ', validVertexes.length, 'out of', splatCount);

            const centersForBucketCalcs = [];
            for (let row = 0; row < validVertexes.length; row++) {
                rawVertex = validVertexes[row];
                centersForBucketCalcs.push([rawVertex.x, rawVertex.y, rawVertex.z]);
            }
            const buckets = this.computeBuckets(centersForBucketCalcs);

            const paddedSplatCount = buckets.length * SplatBufferBucketSize;
            const headerSize = SplatBuffer.HeaderSizeBytes;
            const header = new Uint8Array(new ArrayBuffer(headerSize));
            header[3] = compressionLevel;
            (new Uint32Array(header.buffer, 4, 1))[0] = paddedSplatCount;

            let bytesPerCenter = SplatBuffer.CompressionLevels[compressionLevel].BytesPerCenter;
            let bytesPerScale = SplatBuffer.CompressionLevels[compressionLevel].BytesPerScale;
            let bytesPerColor = SplatBuffer.CompressionLevels[compressionLevel].BytesPerColor;
            let bytesPerRotation = SplatBuffer.CompressionLevels[compressionLevel].BytesPerRotation;
            const centerBuffer = new ArrayBuffer(bytesPerCenter * paddedSplatCount);
            const scaleBuffer = new ArrayBuffer(bytesPerScale * paddedSplatCount);
            const colorBuffer = new ArrayBuffer(bytesPerColor * paddedSplatCount);
            const rotationBuffer = new ArrayBuffer(bytesPerRotation * paddedSplatCount);

            const blockHalfSize = SplatBufferBucketBlockSize / 2.0;
            const compressionScaleRange = SplatBuffer.CompressionLevels[compressionLevel].ScaleRange;
            const compressionScaleFactor = compressionScaleRange / blockHalfSize;
            const doubleCompressionScaleRange = compressionScaleRange * 2 + 1;

            const bucketCenter = new THREE__namespace.Vector3();
            const bucketCenterDelta = new THREE__namespace.Vector3();
            let outSplatIndex = 0;
            for (let b = 0; b < buckets.length; b++) {
                const bucket = buckets[b];
                bucketCenter.fromArray(bucket.center);
                for (let i = 0; i < bucket.splats.length; i++) {
                    let row = bucket.splats[i];
                    let invalidSplat = false;
                    if (row === 0) {
                        invalidSplat = true;
                    }
                    rawVertex = validVertexes[row];

                    if (compressionLevel === 0) {
                        const center = new Float32Array(centerBuffer, outSplatIndex * bytesPerCenter, 3);
                        const scales = new Float32Array(scaleBuffer, outSplatIndex * bytesPerScale, 3);
                        const rot = new Float32Array(rotationBuffer, outSplatIndex * bytesPerRotation, 4);
                        if (propertyTypes['scale_0']) {
                            const quat = new THREE__namespace.Quaternion(rawVertex.rot_1, rawVertex.rot_2, rawVertex.rot_3, rawVertex.rot_0);
                            quat.normalize();
                            rot.set([quat.w, quat.x, quat.y, quat.z]);
                            scales.set([Math.exp(rawVertex.scale_0), Math.exp(rawVertex.scale_1), Math.exp(rawVertex.scale_2)]);
                        } else {
                            scales.set([0.01, 0.01, 0.01]);
                            rot.set([1.0, 0.0, 0.0, 0.0]);
                        }
                        center.set([rawVertex.x, rawVertex.y, rawVertex.z]);
                    } else {
                        const center = new Uint16Array(centerBuffer, outSplatIndex * bytesPerCenter, 3);
                        const scales = new Uint16Array(scaleBuffer, outSplatIndex * bytesPerScale, 3);
                        const rot = new Uint16Array(rotationBuffer, outSplatIndex * bytesPerRotation, 4);
                        const thf = THREE__namespace.DataUtils.toHalfFloat.bind(THREE__namespace.DataUtils);
                        if (propertyTypes['scale_0']) {
                            const quat = new THREE__namespace.Quaternion(rawVertex.rot_1, rawVertex.rot_2, rawVertex.rot_3, rawVertex.rot_0);
                            quat.normalize();
                            rot.set([thf(quat.w), thf(quat.x), thf(quat.y), thf(quat.z)]);
                            scales.set([thf(Math.exp(rawVertex.scale_0)), thf(Math.exp(rawVertex.scale_1)), thf(Math.exp(rawVertex.scale_2))]);
                        } else {
                            scales.set([thf(0.01), thf(0.01), thf(0.01)]);
                            rot.set([thf(1.), 0, 0, 0]);
                        }
                        bucketCenterDelta.set(rawVertex.x, rawVertex.y, rawVertex.z).sub(bucketCenter);
                        bucketCenterDelta.x = Math.round(bucketCenterDelta.x * compressionScaleFactor) + compressionScaleRange;
                        bucketCenterDelta.x = clamp$1(bucketCenterDelta.x, 0, doubleCompressionScaleRange);
                        bucketCenterDelta.y = Math.round(bucketCenterDelta.y * compressionScaleFactor) + compressionScaleRange;
                        bucketCenterDelta.y = clamp$1(bucketCenterDelta.y, 0, doubleCompressionScaleRange);
                        bucketCenterDelta.z = Math.round(bucketCenterDelta.z * compressionScaleFactor) + compressionScaleRange;
                        bucketCenterDelta.z = clamp$1(bucketCenterDelta.z, 0, doubleCompressionScaleRange);
                        center.set([bucketCenterDelta.x, bucketCenterDelta.y, bucketCenterDelta.z]);
                    }

                    const rgba = new Uint8ClampedArray(colorBuffer, outSplatIndex * bytesPerColor, 4);
                    if (invalidSplat) {
                        rgba[0] = 255;
                        rgba[1] = 0;
                        rgba[2] = 0;
                        rgba[3] = 0;
                    } else {
                        if (propertyTypes['f_dc_0']) {
                            const SH_C0 = 0.28209479177387814;
                            rgba.set([(0.5 + SH_C0 * rawVertex.f_dc_0) * 255,
                                      (0.5 + SH_C0 * rawVertex.f_dc_1) * 255,
                                      (0.5 + SH_C0 * rawVertex.f_dc_2) * 255]);
                        } else {
                            rgba.set([255, 0, 0]);
                        }
                        if (propertyTypes['opacity']) {
                            rgba[3] = (1 / (1 + Math.exp(-rawVertex.opacity))) * 255;
                        } else {
                            rgba[3] = 255;
                        }
                    }

                    outSplatIndex++;
                }
            }

            const bytesPerBucket = 12;
            const bucketsSize = bytesPerBucket * buckets.length;
            const splatDataBufferSize = centerBuffer.byteLength + scaleBuffer.byteLength +
                                        colorBuffer.byteLength + rotationBuffer.byteLength;

            const headerArrayUint32 = new Uint32Array(header.buffer);
            const headerArrayFloat32 = new Float32Array(header.buffer);
            let unifiedBufferSize = headerSize + splatDataBufferSize;
            if (compressionLevel > 0) {
                unifiedBufferSize += bucketsSize;
                headerArrayUint32[2] = SplatBufferBucketSize;
                headerArrayUint32[3] = buckets.length;
                headerArrayFloat32[4] = SplatBufferBucketBlockSize;
                headerArrayUint32[5] = bytesPerBucket;
                headerArrayUint32[6] = SplatBuffer.CompressionLevels[compressionLevel].ScaleRange;
            }

            const unifiedBuffer = new ArrayBuffer(unifiedBufferSize);
            new Uint8Array(unifiedBuffer, 0, headerSize).set(header);
            new Uint8Array(unifiedBuffer, headerSize, centerBuffer.byteLength).set(new Uint8Array(centerBuffer));
            new Uint8Array(unifiedBuffer, headerSize + centerBuffer.byteLength, scaleBuffer.byteLength).set(new Uint8Array(scaleBuffer));
            new Uint8Array(unifiedBuffer, headerSize + centerBuffer.byteLength + scaleBuffer.byteLength,
                           colorBuffer.byteLength).set(new Uint8Array(colorBuffer));
            new Uint8Array(unifiedBuffer, headerSize + centerBuffer.byteLength + scaleBuffer.byteLength + colorBuffer.byteLength,
                           rotationBuffer.byteLength).set(new Uint8Array(rotationBuffer));

            if (compressionLevel > 0) {
                const bucketArray = new Float32Array(unifiedBuffer, headerSize + splatDataBufferSize, buckets.length * 3);
                for (let i = 0; i < buckets.length; i++) {
                    const bucket = buckets[i];
                    const base = i * 3;
                    bucketArray[base] = bucket.center[0];
                    bucketArray[base + 1] = bucket.center[1];
                    bucketArray[base + 2] = bucket.center[2];
                }
            }

            const splatBuffer = new SplatBuffer(unifiedBuffer);

            const endTime = performance.now();

            console.log('Parsing PLY to SPLAT complete!');
            console.log('Total time: ', (endTime - startTime).toFixed(2) + ' ms');

            return splatBuffer;
        }

        computeBuckets(centers) {
            const blockSize = SplatBufferBucketBlockSize;
            const halfBlockSize = blockSize / 2.0;
            const splatCount = centers.length;

            const min = new THREE__namespace.Vector3();
            const max = new THREE__namespace.Vector3();

            // ignore the first splat since it's the invalid designator
            for (let i = 1; i < splatCount; i++) {
                const center = centers[i];
                if (i === 0 || center[0] < min.x) min.x = center[0];
                if (i === 0 || center[0] > max.x) max.x = center[0];
                if (i === 0 || center[1] < min.y) min.y = center[1];
                if (i === 0 || center[1] > max.y) max.y = center[1];
                if (i === 0 || center[2] < min.z) min.z = center[2];
                if (i === 0 || center[2] > max.z) max.z = center[2];
            }

            const dimensions = new THREE__namespace.Vector3().copy(max).sub(min);
            const yBlocks = Math.ceil(dimensions.y / blockSize);
            const zBlocks = Math.ceil(dimensions.z / blockSize);

            const blockCenter = new THREE__namespace.Vector3();
            const fullBuckets = [];
            const partiallyFullBuckets = {};

            // ignore the first splat since it's the invalid designator
            for (let i = 1; i < splatCount; i++) {
                const center = centers[i];
                const xBlock = Math.ceil((center[0] - min.x) / blockSize);
                const yBlock = Math.ceil((center[1] - min.y) / blockSize);
                const zBlock = Math.ceil((center[2] - min.z) / blockSize);

                blockCenter.x = (xBlock - 1) * blockSize + min.x + halfBlockSize;
                blockCenter.y = (yBlock - 1) * blockSize + min.y + halfBlockSize;
                blockCenter.z = (zBlock - 1) * blockSize + min.z + halfBlockSize;

                const bucketId = xBlock * (yBlocks * zBlocks) + yBlock * zBlocks + zBlock;
                let bucket = partiallyFullBuckets[bucketId];
                if (!bucket) {
                    partiallyFullBuckets[bucketId] = bucket = {
                        'splats': [],
                        'center': blockCenter.toArray()
                    };
                }

                bucket.splats.push(i);
                if (bucket.splats.length >= SplatBufferBucketSize) {
                    fullBuckets.push(bucket);
                    partiallyFullBuckets[bucketId] = null;
                }
            }

            // fill partially full buckets with invalid splats (splat 0)
            // to get them up to SplatBufferBucketSize
            for (let bucketId in partiallyFullBuckets) {
                if (partiallyFullBuckets.hasOwnProperty(bucketId)) {
                    const bucket = partiallyFullBuckets[bucketId];
                    if (bucket) {
                        while (bucket.splats.length < SplatBufferBucketSize) {
                            bucket.splats.push(0);
                        }
                        fullBuckets.push(bucket);
                    }
                }
            }

            return fullBuckets;
        }
    }

    class PlyLoader {

        constructor() {
            this.splatBuffer = null;
        }

        fetchFile(fileName, onProgress) {
            return new Promise((resolve, reject) => {
                fetchWithProgress(fileName, onProgress)
                .then((data) => {
                    resolve(data);
                })
                .catch((err) => {
                    reject(err);
                });
            });
        }

        loadFromURL(fileName, onProgress, compressionLevel = 0, minimumAlpha = 1) {
            return new Promise((resolve, reject) => {
                const loadPromise = this.fetchFile(fileName, onProgress);
                loadPromise
                .then((plyFileData) => {
                    const plyParser = new PlyParser(plyFileData);
                    const splatBuffer = plyParser.parseToSplatBuffer(compressionLevel, minimumAlpha);
                    this.splatBuffer = splatBuffer;
                    resolve(splatBuffer);
                })
                .catch((err) => {
                    reject(err);
                });
            });
        }

    }

    class SplatLoader {

        constructor(splatBuffer = null) {
            this.splatBuffer = splatBuffer;
            this.downLoadLink = null;
        }

        loadFromURL(fileName, onProgress) {
            return new Promise((resolve, reject) => {
                fetchWithProgress(fileName, onProgress)
                .then((bufferData) => {
                    const splatBuffer = new SplatBuffer(bufferData);
                    resolve(splatBuffer);
                })
                .catch((err) => {
                    reject(err);
                });
            });
        }

        setFromBuffer(splatBuffer) {
            this.splatBuffer = splatBuffer;
        }

        downloadFile(fileName) {
            const headerData = new Uint8Array(this.splatBuffer.getHeaderBufferData());
            const splatData = new Uint8Array(this.splatBuffer.getSplatBufferData());
            const blob = new Blob([headerData.buffer, splatData.buffer], {
                type: 'application/octet-stream',
            });

            if (!this.downLoadLink) {
                this.downLoadLink = document.createElement('a');
                document.body.appendChild(this.downLoadLink);
            }
            this.downLoadLink.download = fileName;
            this.downLoadLink.href = URL.createObjectURL(blob);
            this.downLoadLink.click();
        }

    }

    // OrbitControls performs orbiting, dollying (zooming), and panning.
    // Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
    //
    //    Orbit - left mouse / touch: one-finger move
    //    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
    //    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

    const _changeEvent = { type: 'change' };
    const _startEvent = { type: 'start' };
    const _endEvent = { type: 'end' };
    const _ray = new THREE.Ray();
    const _plane = new THREE.Plane();
    const TILT_LIMIT = Math.cos( 70 * THREE.MathUtils.DEG2RAD );

    class OrbitControls extends THREE.EventDispatcher {

        constructor( object, domElement ) {

            super();

            this.object = object;
            this.domElement = domElement;
            this.domElement.style.touchAction = 'none'; // disable touch scroll

            // Set to false to disable this control
            this.enabled = true;

            // "target" sets the location of focus, where the object orbits around
            this.target = new THREE.Vector3();

            // How far you can dolly in and out ( PerspectiveCamera only )
            this.minDistance = 0;
            this.maxDistance = Infinity;

            // How far you can zoom in and out ( OrthographicCamera only )
            this.minZoom = 0;
            this.maxZoom = Infinity;

            // How far you can orbit vertically, upper and lower limits.
            // Range is 0 to Math.PI radians.
            this.minPolarAngle = 0; // radians
            this.maxPolarAngle = Math.PI; // radians

            // How far you can orbit horizontally, upper and lower limits.
            // If set, the interval [min, max] must be a sub-interval of [- 2 PI, 2 PI], with ( max - min < 2 PI )
            this.minAzimuthAngle = - Infinity; // radians
            this.maxAzimuthAngle = Infinity; // radians

            // Set to true to enable damping (inertia)
            // If damping is enabled, you must call controls.update() in your animation loop
            this.enableDamping = false;
            this.dampingFactor = 0.05;

            // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
            // Set to false to disable zooming
            this.enableZoom = true;
            this.zoomSpeed = 1.0;

            // Set to false to disable rotating
            this.enableRotate = true;
            this.rotateSpeed = 1.0;

            // Set to false to disable panning
            this.enablePan = true;
            this.panSpeed = 1.0;
            this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
            this.keyPanSpeed = 7.0; // pixels moved per arrow key push
            this.zoomToCursor = false;

            // Set to true to automatically rotate around the target
            // If auto-rotate is enabled, you must call controls.update() in your animation loop
            this.autoRotate = false;
            this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

            // The four arrow keys
            this.keys = { LEFT: 'KeyA', UP: 'KeyW', RIGHT: 'KeyD', BOTTOM: 'KeyS' };

            // Mouse buttons
            this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

            // Touch fingers
            this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

            // for reset
            this.target0 = this.target.clone();
            this.position0 = this.object.position.clone();
            this.zoom0 = this.object.zoom;

            // the target DOM element for key events
            this._domElementKeyEvents = null;

            //
            // public methods
            //

            this.getPolarAngle = function() {

                return spherical.phi;

            };

            this.getAzimuthalAngle = function() {

                return spherical.theta;

            };

            this.getDistance = function() {

                return this.object.position.distanceTo( this.target );

            };

            this.listenToKeyEvents = function( domElement ) {

                domElement.addEventListener( 'keydown', onKeyDown );
                this._domElementKeyEvents = domElement;

            };

            this.stopListenToKeyEvents = function() {

                this._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
                this._domElementKeyEvents = null;

            };

            this.saveState = function() {

                scope.target0.copy( scope.target );
                scope.position0.copy( scope.object.position );
                scope.zoom0 = scope.object.zoom;

            };

            this.reset = function() {

                scope.target.copy( scope.target0 );
                scope.object.position.copy( scope.position0 );
                scope.object.zoom = scope.zoom0;

                scope.object.updateProjectionMatrix();
                scope.dispatchEvent( _changeEvent );

                scope.update();

                state = STATE.NONE;

            };

            // this method is exposed, but perhaps it would be better if we can make it private...
            this.update = function() {

                const offset = new THREE.Vector3();

                // so camera.up is the orbit axis
                const quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
                const quatInverse = quat.clone().invert();

                const lastPosition = new THREE.Vector3();
                const lastQuaternion = new THREE.Quaternion();
                const lastTargetPosition = new THREE.Vector3();

                const twoPI = 2 * Math.PI;

                return function update() {

                    quat.setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
                    quatInverse.copy(quat).invert();

                    const position = scope.object.position;

                    offset.copy( position ).sub( scope.target );

                    // rotate offset to "y-axis-is-up" space
                    offset.applyQuaternion( quat );

                    // angle from z-axis around y-axis
                    spherical.setFromVector3( offset );

                    if ( scope.autoRotate && state === STATE.NONE ) {

                        rotateLeft( getAutoRotationAngle() );

                    }

                    if ( scope.enableDamping ) {

                        spherical.theta += sphericalDelta.theta * scope.dampingFactor;
                        spherical.phi += sphericalDelta.phi * scope.dampingFactor;

                    } else {

                        spherical.theta += sphericalDelta.theta;
                        spherical.phi += sphericalDelta.phi;

                    }

                    // restrict theta to be between desired limits

                    let min = scope.minAzimuthAngle;
                    let max = scope.maxAzimuthAngle;

                    if ( isFinite( min ) && isFinite( max ) ) {

                        if ( min < - Math.PI ) min += twoPI; else if ( min > Math.PI ) min -= twoPI;

                        if ( max < - Math.PI ) max += twoPI; else if ( max > Math.PI ) max -= twoPI;

                        if ( min <= max ) {

                            spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );

                        } else {

                            spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ?
                                Math.max( min, spherical.theta ) :
                                Math.min( max, spherical.theta );

                        }

                    }

                    // restrict phi to be between desired limits
                    spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

                    spherical.makeSafe();


                    // move target to panned location

                    if ( scope.enableDamping === true ) {

                        scope.target.addScaledVector( panOffset, scope.dampingFactor );

                    } else {

                        scope.target.add( panOffset );

                    }

                    // adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
                    // we adjust zoom later in these cases
                    if ( scope.zoomToCursor && performCursorZoom || scope.object.isOrthographicCamera ) {

                        spherical.radius = clampDistance( spherical.radius );

                    } else {

                        spherical.radius = clampDistance( spherical.radius * scale );

                    }


                    offset.setFromSpherical( spherical );

                    // rotate offset back to "camera-up-vector-is-up" space
                    offset.applyQuaternion( quatInverse );

                    position.copy( scope.target ).add( offset );

                    scope.object.lookAt( scope.target );

                    if ( scope.enableDamping === true ) {

                        sphericalDelta.theta *= ( 1 - scope.dampingFactor );
                        sphericalDelta.phi *= ( 1 - scope.dampingFactor );

                        panOffset.multiplyScalar( 1 - scope.dampingFactor );

                    } else {

                        sphericalDelta.set( 0, 0, 0 );

                        panOffset.set( 0, 0, 0 );

                    }

                    // adjust camera position
                    let zoomChanged = false;
                    if ( scope.zoomToCursor && performCursorZoom ) {

                        let newRadius = null;
                        if ( scope.object.isPerspectiveCamera ) {

                            // move the camera down the pointer ray
                            // this method avoids floating point error
                            const prevRadius = offset.length();
                            newRadius = clampDistance( prevRadius * scale );

                            const radiusDelta = prevRadius - newRadius;
                            scope.object.position.addScaledVector( dollyDirection, radiusDelta );
                            scope.object.updateMatrixWorld();

                        } else if ( scope.object.isOrthographicCamera ) {

                            // adjust the ortho camera position based on zoom changes
                            const mouseBefore = new THREE.Vector3( mouse.x, mouse.y, 0 );
                            mouseBefore.unproject( scope.object );

                            scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / scale ) );
                            scope.object.updateProjectionMatrix();
                            zoomChanged = true;

                            const mouseAfter = new THREE.Vector3( mouse.x, mouse.y, 0 );
                            mouseAfter.unproject( scope.object );

                            scope.object.position.sub( mouseAfter ).add( mouseBefore );
                            scope.object.updateMatrixWorld();

                            newRadius = offset.length();

                        } else {

                            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
                            scope.zoomToCursor = false;

                        }

                        // handle the placement of the target
                        if ( newRadius !== null ) {

                            if ( this.screenSpacePanning ) {

                                // position the orbit target in front of the new camera position
                                scope.target.set( 0, 0, - 1 )
                                    .transformDirection( scope.object.matrix )
                                    .multiplyScalar( newRadius )
                                    .add( scope.object.position );

                            } else {

                                // get the ray and translation plane to compute target
                                _ray.origin.copy( scope.object.position );
                                _ray.direction.set( 0, 0, - 1 ).transformDirection( scope.object.matrix );

                                // if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
                                // extremely large values
                                if ( Math.abs( scope.object.up.dot( _ray.direction ) ) < TILT_LIMIT ) {

                                    object.lookAt( scope.target );

                                } else {

                                    _plane.setFromNormalAndCoplanarPoint( scope.object.up, scope.target );
                                    _ray.intersectPlane( _plane, scope.target );

                                }

                            }

                        }

                    } else if ( scope.object.isOrthographicCamera ) {

                        scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / scale ) );
                        scope.object.updateProjectionMatrix();
                        zoomChanged = true;

                    }

                    scale = 1;
                    performCursorZoom = false;

                    // update condition is:
                    // min(camera displacement, camera rotation in radians)^2 > EPS
                    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

                    if ( zoomChanged ||
                        lastPosition.distanceToSquared( scope.object.position ) > EPS ||
                        8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ||
                        lastTargetPosition.distanceToSquared( scope.target ) > 0 ) {

                        scope.dispatchEvent( _changeEvent );

                        lastPosition.copy( scope.object.position );
                        lastQuaternion.copy( scope.object.quaternion );
                        lastTargetPosition.copy( scope.target );

                        zoomChanged = false;

                        return true;

                    }

                    return false;

                };

            }();

            this.dispose = function() {

                scope.domElement.removeEventListener( 'contextmenu', onContextMenu );

                scope.domElement.removeEventListener( 'pointerdown', onPointerDown );
                scope.domElement.removeEventListener( 'pointercancel', onPointerUp );
                scope.domElement.removeEventListener( 'wheel', onMouseWheel );

                scope.domElement.removeEventListener( 'pointermove', onPointerMove );
                scope.domElement.removeEventListener( 'pointerup', onPointerUp );


                if ( scope._domElementKeyEvents !== null ) {

                    scope._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
                    scope._domElementKeyEvents = null;

                }

            };

            //
            // internals
            //

            const scope = this;

            const STATE = {
                NONE: - 1,
                ROTATE: 0,
                DOLLY: 1,
                PAN: 2,
                TOUCH_ROTATE: 3,
                TOUCH_PAN: 4,
                TOUCH_DOLLY_PAN: 5,
                TOUCH_DOLLY_ROTATE: 6
            };

            let state = STATE.NONE;

            const EPS = 0.000001;

            // current position in spherical coordinates
            const spherical = new THREE.Spherical();
            const sphericalDelta = new THREE.Spherical();

            let scale = 1;
            const panOffset = new THREE.Vector3();

            const rotateStart = new THREE.Vector2();
            const rotateEnd = new THREE.Vector2();
            const rotateDelta = new THREE.Vector2();

            const panStart = new THREE.Vector2();
            const panEnd = new THREE.Vector2();
            const panDelta = new THREE.Vector2();

            const dollyStart = new THREE.Vector2();
            const dollyEnd = new THREE.Vector2();
            const dollyDelta = new THREE.Vector2();

            const dollyDirection = new THREE.Vector3();
            const mouse = new THREE.Vector2();
            let performCursorZoom = false;

            const pointers = [];
            const pointerPositions = {};

            function getAutoRotationAngle() {

                return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

            }

            function getZoomScale() {

                return Math.pow( 0.95, scope.zoomSpeed );

            }

            function rotateLeft( angle ) {

                sphericalDelta.theta -= angle;

            }

            function rotateUp( angle ) {

                sphericalDelta.phi -= angle;

            }

            const panLeft = function() {

                const v = new THREE.Vector3();

                return function panLeft( distance, objectMatrix ) {

                    v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
                    v.multiplyScalar( - distance );

                    panOffset.add( v );

                };

            }();

            const panUp = function() {

                const v = new THREE.Vector3();

                return function panUp( distance, objectMatrix ) {

                    if ( scope.screenSpacePanning === true ) {

                        v.setFromMatrixColumn( objectMatrix, 1 );

                    } else {

                        v.setFromMatrixColumn( objectMatrix, 0 );
                        v.crossVectors( scope.object.up, v );

                    }

                    v.multiplyScalar( distance );

                    panOffset.add( v );

                };

            }();

            // deltaX and deltaY are in pixels; right and down are positive
            const pan = function() {

                const offset = new THREE.Vector3();

                return function pan( deltaX, deltaY ) {

                    const element = scope.domElement;

                    if ( scope.object.isPerspectiveCamera ) {

                        // perspective
                        const position = scope.object.position;
                        offset.copy( position ).sub( scope.target );
                        let targetDistance = offset.length();

                        // half of the fov is center to top of screen
                        targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

                        // we use only clientHeight here so aspect ratio does not distort speed
                        panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
                        panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

                    } else if ( scope.object.isOrthographicCamera ) {

                        // orthographic
                        panLeft( deltaX * ( scope.object.right - scope.object.left ) /
                                            scope.object.zoom / element.clientWidth, scope.object.matrix );
                        panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom /
                                          element.clientHeight, scope.object.matrix );

                    } else {

                        // camera neither orthographic nor perspective
                        console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
                        scope.enablePan = false;

                    }

                };

            }();

            function dollyOut( dollyScale ) {

                if ( scope.object.isPerspectiveCamera || scope.object.isOrthographicCamera ) {

                    scale /= dollyScale;

                } else {

                    console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                    scope.enableZoom = false;

                }

            }

            function dollyIn( dollyScale ) {

                if ( scope.object.isPerspectiveCamera || scope.object.isOrthographicCamera ) {

                    scale *= dollyScale;

                } else {

                    console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                    scope.enableZoom = false;

                }

            }

            function updateMouseParameters( event ) {

                if ( ! scope.zoomToCursor ) {

                    return;

                }

                performCursorZoom = true;

                const rect = scope.domElement.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                const w = rect.width;
                const h = rect.height;

                mouse.x = ( x / w ) * 2 - 1;
                mouse.y = - ( y / h ) * 2 + 1;

                dollyDirection.set( mouse.x, mouse.y, 1 ).unproject( object ).sub( object.position ).normalize();

            }

            function clampDistance( dist ) {

                return Math.max( scope.minDistance, Math.min( scope.maxDistance, dist ) );

            }

            //
            // event callbacks - update the object state
            //

            function handleMouseDownRotate( event ) {

                rotateStart.set( event.clientX, event.clientY );

            }

            function handleMouseDownDolly( event ) {

                updateMouseParameters( event );
                dollyStart.set( event.clientX, event.clientY );

            }

            function handleMouseDownPan( event ) {

                panStart.set( event.clientX, event.clientY );

            }

            function handleMouseMoveRotate( event ) {

                rotateEnd.set( event.clientX, event.clientY );

                rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

                const element = scope.domElement;

                rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

                rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

                rotateStart.copy( rotateEnd );

                scope.update();

            }

            function handleMouseMoveDolly( event ) {

                dollyEnd.set( event.clientX, event.clientY );

                dollyDelta.subVectors( dollyEnd, dollyStart );

                if ( dollyDelta.y > 0 ) {

                    dollyOut( getZoomScale() );

                } else if ( dollyDelta.y < 0 ) {

                    dollyIn( getZoomScale() );

                }

                dollyStart.copy( dollyEnd );

                scope.update();

            }

            function handleMouseMovePan( event ) {

                panEnd.set( event.clientX, event.clientY );

                panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

                pan( panDelta.x, panDelta.y );

                panStart.copy( panEnd );

                scope.update();

            }

            function handleMouseWheel( event ) {

                updateMouseParameters( event );

                if ( event.deltaY < 0 ) {

                    dollyIn( getZoomScale() );

                } else if ( event.deltaY > 0 ) {

                    dollyOut( getZoomScale() );

                }

                scope.update();

            }

            function handleKeyDown( event ) {

                let needsUpdate = false;

                switch ( event.code ) {

                    case scope.keys.UP:

                        if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

                            rotateUp( 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

                        } else {

                            pan( 0, scope.keyPanSpeed );

                        }

                        needsUpdate = true;
                        break;

                    case scope.keys.BOTTOM:

                        if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

                            rotateUp( - 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

                        } else {

                            pan( 0, - scope.keyPanSpeed );

                        }

                        needsUpdate = true;
                        break;

                    case scope.keys.LEFT:

                        if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

                            rotateLeft( 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

                        } else {

                            pan( scope.keyPanSpeed, 0 );

                        }

                        needsUpdate = true;
                        break;

                    case scope.keys.RIGHT:

                        if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

                            rotateLeft( - 2 * Math.PI * scope.rotateSpeed / scope.domElement.clientHeight );

                        } else {

                            pan( - scope.keyPanSpeed, 0 );

                        }

                        needsUpdate = true;
                        break;

                }

                if ( needsUpdate ) {

                    // prevent the browser from scrolling on cursor keys
                    event.preventDefault();

                    scope.update();

                }


            }

            function handleTouchStartRotate() {

                if ( pointers.length === 1 ) {

                    rotateStart.set( pointers[0].pageX, pointers[0].pageY );

                } else {

                    const x = 0.5 * ( pointers[0].pageX + pointers[1].pageX );
                    const y = 0.5 * ( pointers[0].pageY + pointers[1].pageY );

                    rotateStart.set( x, y );

                }

            }

            function handleTouchStartPan() {

                if ( pointers.length === 1 ) {

                    panStart.set( pointers[0].pageX, pointers[0].pageY );

                } else {

                    const x = 0.5 * ( pointers[0].pageX + pointers[1].pageX );
                    const y = 0.5 * ( pointers[0].pageY + pointers[1].pageY );

                    panStart.set( x, y );

                }

            }

            function handleTouchStartDolly() {

                const dx = pointers[0].pageX - pointers[1].pageX;
                const dy = pointers[0].pageY - pointers[1].pageY;

                const distance = Math.sqrt( dx * dx + dy * dy );

                dollyStart.set( 0, distance );

            }

            function handleTouchStartDollyPan() {

                if ( scope.enableZoom ) handleTouchStartDolly();

                if ( scope.enablePan ) handleTouchStartPan();

            }

            function handleTouchStartDollyRotate() {

                if ( scope.enableZoom ) handleTouchStartDolly();

                if ( scope.enableRotate ) handleTouchStartRotate();

            }

            function handleTouchMoveRotate( event ) {

                if ( pointers.length == 1 ) {

                    rotateEnd.set( event.pageX, event.pageY );

                } else {

                    const position = getSecondPointerPosition( event );

                    const x = 0.5 * ( event.pageX + position.x );
                    const y = 0.5 * ( event.pageY + position.y );

                    rotateEnd.set( x, y );

                }

                rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

                const element = scope.domElement;

                rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

                rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

                rotateStart.copy( rotateEnd );

            }

            function handleTouchMovePan( event ) {

                if ( pointers.length === 1 ) {

                    panEnd.set( event.pageX, event.pageY );

                } else {

                    const position = getSecondPointerPosition( event );

                    const x = 0.5 * ( event.pageX + position.x );
                    const y = 0.5 * ( event.pageY + position.y );

                    panEnd.set( x, y );

                }

                panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

                pan( panDelta.x, panDelta.y );

                panStart.copy( panEnd );

            }

            function handleTouchMoveDolly( event ) {

                const position = getSecondPointerPosition( event );

                const dx = event.pageX - position.x;
                const dy = event.pageY - position.y;

                const distance = Math.sqrt( dx * dx + dy * dy );

                dollyEnd.set( 0, distance );

                dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );

                dollyOut( dollyDelta.y );

                dollyStart.copy( dollyEnd );

            }

            function handleTouchMoveDollyPan( event ) {

                if ( scope.enableZoom ) handleTouchMoveDolly( event );

                if ( scope.enablePan ) handleTouchMovePan( event );

            }

            function handleTouchMoveDollyRotate( event ) {

                if ( scope.enableZoom ) handleTouchMoveDolly( event );

                if ( scope.enableRotate ) handleTouchMoveRotate( event );

            }

            //
            // event handlers - FSM: listen for events and reset state
            //

            function onPointerDown( event ) {

                if ( scope.enabled === false ) return;

                if ( pointers.length === 0 ) {

                    scope.domElement.setPointerCapture( event.pointerId );

                    scope.domElement.addEventListener( 'pointermove', onPointerMove );
                    scope.domElement.addEventListener( 'pointerup', onPointerUp );

                }

                //

                addPointer( event );

                if ( event.pointerType === 'touch' ) {

                    onTouchStart( event );

                } else {

                    onMouseDown( event );

                }

            }

            function onPointerMove( event ) {

                if ( scope.enabled === false ) return;

                if ( event.pointerType === 'touch' ) {

                    onTouchMove( event );

                } else {

                    onMouseMove( event );

                }

            }

            function onPointerUp( event ) {

                removePointer( event );

                if ( pointers.length === 0 ) {

                    scope.domElement.releasePointerCapture( event.pointerId );

                    scope.domElement.removeEventListener( 'pointermove', onPointerMove );
                    scope.domElement.removeEventListener( 'pointerup', onPointerUp );

                }

                scope.dispatchEvent( _endEvent );

                state = STATE.NONE;

            }

            function onMouseDown( event ) {

                let mouseAction;

                switch ( event.button ) {

                    case 0:

                        mouseAction = scope.mouseButtons.LEFT;
                        break;

                    case 1:

                        mouseAction = scope.mouseButtons.MIDDLE;
                        break;

                    case 2:

                        mouseAction = scope.mouseButtons.RIGHT;
                        break;

                    default:

                        mouseAction = - 1;

                }

                switch ( mouseAction ) {

                    case THREE.MOUSE.DOLLY:

                        if ( scope.enableZoom === false ) return;

                        handleMouseDownDolly( event );

                        state = STATE.DOLLY;

                        break;

                    case THREE.MOUSE.ROTATE:

                        if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

                            if ( scope.enablePan === false ) return;

                            handleMouseDownPan( event );

                            state = STATE.PAN;

                        } else {

                            if ( scope.enableRotate === false ) return;

                            handleMouseDownRotate( event );

                            state = STATE.ROTATE;

                        }

                        break;

                    case THREE.MOUSE.PAN:

                        if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

                            if ( scope.enableRotate === false ) return;

                            handleMouseDownRotate( event );

                            state = STATE.ROTATE;

                        } else {

                            if ( scope.enablePan === false ) return;

                            handleMouseDownPan( event );

                            state = STATE.PAN;

                        }

                        break;

                    default:

                        state = STATE.NONE;

                }

                if ( state !== STATE.NONE ) {

                    scope.dispatchEvent( _startEvent );

                }

            }

            function onMouseMove( event ) {

                switch ( state ) {

                    case STATE.ROTATE:

                        if ( scope.enableRotate === false ) return;

                        handleMouseMoveRotate( event );

                        break;

                    case STATE.DOLLY:

                        if ( scope.enableZoom === false ) return;

                        handleMouseMoveDolly( event );

                        break;

                    case STATE.PAN:

                        if ( scope.enablePan === false ) return;

                        handleMouseMovePan( event );

                        break;

                }

            }

            function onMouseWheel( event ) {

                if ( scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE ) return;

                event.preventDefault();

                scope.dispatchEvent( _startEvent );

                handleMouseWheel( event );

                scope.dispatchEvent( _endEvent );

            }

            function onKeyDown( event ) {

                if ( scope.enabled === false || scope.enablePan === false ) return;

                handleKeyDown( event );

            }

            function onTouchStart( event ) {

                trackPointer( event );

                switch ( pointers.length ) {

                    case 1:

                        switch ( scope.touches.ONE ) {

                            case THREE.TOUCH.ROTATE:

                                if ( scope.enableRotate === false ) return;

                                handleTouchStartRotate();

                                state = STATE.TOUCH_ROTATE;

                                break;

                            case THREE.TOUCH.PAN:

                                if ( scope.enablePan === false ) return;

                                handleTouchStartPan();

                                state = STATE.TOUCH_PAN;

                                break;

                            default:

                                state = STATE.NONE;

                        }

                        break;

                    case 2:

                        switch ( scope.touches.TWO ) {

                            case THREE.TOUCH.DOLLY_PAN:

                                if ( scope.enableZoom === false && scope.enablePan === false ) return;

                                handleTouchStartDollyPan();

                                state = STATE.TOUCH_DOLLY_PAN;

                                break;

                            case THREE.TOUCH.DOLLY_ROTATE:

                                if ( scope.enableZoom === false && scope.enableRotate === false ) return;

                                handleTouchStartDollyRotate();

                                state = STATE.TOUCH_DOLLY_ROTATE;

                                break;

                            default:

                                state = STATE.NONE;

                        }

                        break;

                    default:

                        state = STATE.NONE;

                }

                if ( state !== STATE.NONE ) {

                    scope.dispatchEvent( _startEvent );

                }

            }

            function onTouchMove( event ) {

                trackPointer( event );

                switch ( state ) {

                    case STATE.TOUCH_ROTATE:

                        if ( scope.enableRotate === false ) return;

                        handleTouchMoveRotate( event );

                        scope.update();

                        break;

                    case STATE.TOUCH_PAN:

                        if ( scope.enablePan === false ) return;

                        handleTouchMovePan( event );

                        scope.update();

                        break;

                    case STATE.TOUCH_DOLLY_PAN:

                        if ( scope.enableZoom === false && scope.enablePan === false ) return;

                        handleTouchMoveDollyPan( event );

                        scope.update();

                        break;

                    case STATE.TOUCH_DOLLY_ROTATE:

                        if ( scope.enableZoom === false && scope.enableRotate === false ) return;

                        handleTouchMoveDollyRotate( event );

                        scope.update();

                        break;

                    default:

                        state = STATE.NONE;

                }

            }

            function onContextMenu( event ) {

                if ( scope.enabled === false ) return;

                event.preventDefault();

            }

            function addPointer( event ) {

                pointers.push( event );

            }

            function removePointer( event ) {

                delete pointerPositions[event.pointerId];

                for ( let i = 0; i < pointers.length; i ++ ) {

                    if ( pointers[i].pointerId == event.pointerId ) {

                        pointers.splice( i, 1 );
                        return;

                    }

                }

            }

            function trackPointer( event ) {

                let position = pointerPositions[event.pointerId];

                if ( position === undefined ) {

                    position = new THREE.Vector2();
                    pointerPositions[event.pointerId] = position;

                }

                position.set( event.pageX, event.pageY );

            }

            function getSecondPointerPosition( event ) {

                const pointer = ( event.pointerId === pointers[0].pointerId ) ? pointers[1] : pointers[0];

                return pointerPositions[pointer.pointerId];

            }

            //

            scope.domElement.addEventListener( 'contextmenu', onContextMenu );

            scope.domElement.addEventListener( 'pointerdown', onPointerDown );
            scope.domElement.addEventListener( 'pointercancel', onPointerUp );
            scope.domElement.addEventListener( 'wheel', onMouseWheel, { passive: false } );

            // force an update at start

            this.update();

        }

    }

    class LoadingSpinner {

        constructor(message, container) {
            this.message = message || 'Loading...';
            this.container = container || document.body;

            this.spinnerDivContainer = document.createElement('div');
            this.spinnerDiv = document.createElement('div');
            this.messageDiv = document.createElement('div');
            this.spinnerDivContainer.className = 'loaderContainer';
            this.spinnerDiv.className = 'loader';
            this.spinnerDivContainer.style.display = 'none';
            this.messageDiv.className = 'message';
            this.messageDiv.innerHTML = this.message;
            this.spinnerDivContainer.appendChild(this.spinnerDiv);
            this.spinnerDivContainer.appendChild(this.messageDiv);
            this.container.appendChild(this.spinnerDivContainer);

            const style = document.createElement('style');
            style.innerHTML = `

            .message {
                font-family: arial;
                font-size: 12pt;
                color: #ffffff;
                text-align: center;
                padding-top:15px;
                width: 180px;
            }

            .loaderContainer {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-80px, -80px);
                width: 180px;
            }

            .loader {
                width: 120px;        /* the size */
                padding: 15px;       /* the border thickness */
                background: #07e8d6; /* the color */
                z-index:99999;
            
                aspect-ratio: 1;
                border-radius: 50%;
                --_m: 
                    conic-gradient(#0000,#000),
                    linear-gradient(#000 0 0) content-box;
                -webkit-mask: var(--_m);
                    mask: var(--_m);
                -webkit-mask-composite: source-out;
                    mask-composite: subtract;
                box-sizing: border-box;
                animation: load 1s linear infinite;
                margin-left: 30px;
            }
            
            @keyframes load {
                to{transform: rotate(1turn)}
            }

        `;
            this.spinnerDivContainer.appendChild(style);
        }

        show() {
            this.spinnerDivContainer.style.display = 'block';
        }

        hide() {
            this.spinnerDivContainer.style.display = 'none';
        }

        setMessage(msg) {
            this.messageDiv.innerHTML = msg;
        }
    }

    class ArrowHelper extends THREE__namespace.Object3D {

        constructor(dir = new THREE__namespace.Vector3(0, 0, 1), origin = new THREE__namespace.Vector3(0, 0, 0), length = 1,
                    radius = 0.1, color = 0xffff00, headLength = length * 0.2, headRadius = headLength * 0.2) {
            super();

            this.type = 'ArrowHelper';

            const lineGeometry = new THREE__namespace.CylinderGeometry(radius, radius, length, 32);
            lineGeometry.translate(0, length / 2.0, 0);
            const coneGeometry = new THREE__namespace.CylinderGeometry( 0, headRadius, headLength, 32);
            coneGeometry.translate(0, length, 0);

            this.position.copy( origin );

            this.line = new THREE__namespace.Mesh(lineGeometry, new THREE__namespace.MeshBasicMaterial({color: color, toneMapped: false}));
            this.line.matrixAutoUpdate = false;
            this.add(this.line);

            this.cone = new THREE__namespace.Mesh(coneGeometry, new THREE__namespace.MeshBasicMaterial({color: color, toneMapped: false}));
            this.cone.matrixAutoUpdate = false;
            this.add(this.cone);

            this.setDirection(dir);
        }

        setDirection( dir ) {
            if (dir.y > 0.99999) {
                this.quaternion.set(0, 0, 0, 1);
            } else if (dir.y < - 0.99999) {
                this.quaternion.set(1, 0, 0, 0);
            } else {
                _axis.set(dir.z, 0, -dir.x).normalize();
                const radians = Math.acos(dir.y);
                this.quaternion.setFromAxisAngle(_axis, radians);
            }
        }

        setColor( color ) {
            this.line.material.color.set(color);
            this.cone.material.color.set(color);
        }

        copy(source) {
            super.copy(source, false);
            this.line.copy(source.line);
            this.cone.copy(source.cone);
            return this;
        }

        dispose() {
            this.line.geometry.dispose();
            this.line.material.dispose();
            this.cone.geometry.dispose();
            this.cone.material.dispose();
        }

    }

    class SceneHelper {

        constructor(scene) {
            this.scene = scene;
            this.splatRenderTarget = null;
            this.renderTargetCopyMaterial = null;
            this.renderTargetCopyQuad = null;
            this.renderTargetCopyCamera = null;
            this.meshCursor = null;
            this.focusMarker = null;
            this.controlPlane = null;
        }

        updateSplatRenderTargetForRenderDimensions(width, height) {
            this.splatRenderTarget = new THREE__namespace.WebGLRenderTarget(width, height, {
                format: THREE__namespace.RGBAFormat,
                stencilBuffer: false,
                depthBuffer: true,

            });
            this.splatRenderTarget.depthTexture = new THREE__namespace.DepthTexture(width, height);
            this.splatRenderTarget.depthTexture.format = THREE__namespace.DepthFormat;
            this.splatRenderTarget.depthTexture.type = THREE__namespace.UnsignedIntType;
        }

        setupRenderTargetCopyObjects() {
            const uniforms = {
                'sourceColorTexture': {
                    'type': 't',
                    'value': null
                },
                'sourceDepthTexture': {
                    'type': 't',
                    'value': null
                },
            };
            this.renderTargetCopyMaterial = new THREE__namespace.ShaderMaterial({
                vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4( position.xy, 0.0, 1.0 );    
                }
            `,
                fragmentShader: `
                #include <common>
                #include <packing>
                varying vec2 vUv;
                uniform sampler2D sourceColorTexture;
                uniform sampler2D sourceDepthTexture;
                void main() {
                    vec4 color = texture2D(sourceColorTexture, vUv);
                    float fragDepth = texture2D(sourceDepthTexture, vUv).x;
                    gl_FragDepth = fragDepth;
                    gl_FragColor = vec4(color.rgb, color.a * 2.0);
              }
            `,
                uniforms: uniforms,
                depthWrite: false,
                depthTest: false,
                transparent: true,
                blending: THREE__namespace.CustomBlending,
                blendSrc: THREE__namespace.SrcAlphaFactor,
                blendSrcAlpha: THREE__namespace.SrcAlphaFactor,
                blendDst: THREE__namespace.OneMinusSrcAlphaFactor,
                blendDstAlpha: THREE__namespace.OneMinusSrcAlphaFactor
            });
            this.renderTargetCopyMaterial.extensions.fragDepth = true;
            this.renderTargetCopyQuad = new THREE__namespace.Mesh(new THREE__namespace.PlaneGeometry(2, 2), this.renderTargetCopyMaterial);
            this.renderTargetCopyCamera = new THREE__namespace.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        }

        setupMeshCursor() {
            if (!this.meshCursor) {
                const coneGeometry = new THREE__namespace.ConeGeometry(0.5, 1.5, 32);
                const coneMaterial = new THREE__namespace.MeshBasicMaterial({color: 0xFFFFFF});

                const downArrow = new THREE__namespace.Mesh(coneGeometry, coneMaterial);
                downArrow.rotation.set(0, 0, Math.PI);
                downArrow.position.set(0, 1, 0);
                const upArrow = new THREE__namespace.Mesh(coneGeometry, coneMaterial);
                upArrow.position.set(0, -1, 0);
                const leftArrow = new THREE__namespace.Mesh(coneGeometry, coneMaterial);
                leftArrow.rotation.set(0, 0, Math.PI / 2.0);
                leftArrow.position.set(1, 0, 0);
                const rightArrow = new THREE__namespace.Mesh(coneGeometry, coneMaterial);
                rightArrow.rotation.set(0, 0, -Math.PI / 2.0);
                rightArrow.position.set(-1, 0, 0);

                this.meshCursor = new THREE__namespace.Object3D();
                this.meshCursor.add(downArrow);
                this.meshCursor.add(upArrow);
                this.meshCursor.add(leftArrow);
                this.meshCursor.add(rightArrow);
                this.meshCursor.scale.set(0.1, 0.1, 0.1);
                this.scene.add(this.meshCursor);
                this.meshCursor.visible = false;
            }
        }

        destroyMeshCursor() {
            if (this.meshCursor) {
                this.meshCursor.children.forEach((child) => {
                    child.geometry.dispose();
                    child.material.dispose();
                });
                this.scene.remove(this.meshCursor);
                this.meshCursor = null;
            }
        }

        setMeshCursorVisibility(visible) {
            this.meshCursor.visible = visible;
        }

        setMeshCursorPosition(position) {
            this.meshCursor.position.copy(position);
        }

        positionAndOrientMeshCursor(position, camera) {
            this.meshCursor.position.copy(position);
            this.meshCursor.up.copy(camera.up);
            this.meshCursor.lookAt(camera.position);
        }

        setupFocusMarker() {
            if (!this.focusMarker) {
                const sphereGeometry = new THREE__namespace.SphereGeometry(.5, 32, 32);
                const focusMarkerMaterial = SceneHelper.buildFocusMarkerMaterial();
                focusMarkerMaterial.depthTest = false;
                focusMarkerMaterial.depthWrite = false;
                focusMarkerMaterial.transparent = true;
                const sphereMesh = new THREE__namespace.Mesh(sphereGeometry, focusMarkerMaterial);
                this.focusMarker = sphereMesh;
            }
        }

        updateFocusMarker = function() {

            const tempPosition = new THREE__namespace.Vector3();
            const tempMatrix = new THREE__namespace.Matrix4();

            return function(position, camera, viewport) {
                tempMatrix.copy(camera.matrixWorld).invert();
                tempPosition.copy(position).applyMatrix4(tempMatrix);
                tempPosition.normalize().multiplyScalar(10);
                tempPosition.applyMatrix4(camera.matrixWorld);
                this.focusMarker.position.copy(tempPosition);
                this.focusMarker.material.uniforms.realFocusPosition.value.copy(position);
                this.focusMarker.material.uniforms.viewport.value.copy(viewport);
                this.focusMarker.material.uniformsNeedUpdate = true;
            };

        }();

        setFocusMarkerVisibility(visible) {
            this.focusMarker.visible = visible;
        }

        setFocusMarkerOpacity(opacity) {
            this.focusMarker.material.uniforms.opacity.value = opacity;
            this.focusMarker.material.uniformsNeedUpdate = true;
        }

        getFocusMarkerOpacity() {
            return this.focusMarker.material.uniforms.opacity.value;
        }

        setupControlPlane() {
            const planeGeometry = new THREE__namespace.PlaneGeometry(1, 1);
            planeGeometry.rotateX(-Math.PI / 2);
            const planeMaterial = new THREE__namespace.MeshBasicMaterial({color: 0xffffff});
            planeMaterial.transparent = true;
            planeMaterial.opacity = 0.6;
            planeMaterial.depthTest = false;
            planeMaterial.depthWrite = false;
            planeMaterial.side = THREE__namespace.DoubleSide;
            const planeMesh = new THREE__namespace.Mesh(planeGeometry, planeMaterial);

            const arrowDir = new THREE__namespace.Vector3(0, 1, 0);
            arrowDir.normalize();
            const arrowOrigin = new THREE__namespace.Vector3(0, 0, 0);
            const arrowLength = 0.5;
            const arrowRadius = 0.01;
            const arrowColor = 0x00dd00;
            const arrowHelper = new ArrowHelper(arrowDir, arrowOrigin, arrowLength, arrowRadius, arrowColor, 0.1, 0.03);

            this.controlPlane = new THREE__namespace.Object3D();
            this.controlPlane.add(planeMesh);
            this.controlPlane.add(arrowHelper);
        }

        setControlPlaneVisibility(visible) {
            this.controlPlane.visible = visible;
        }

        positionAndOrientControlPlane = function() {

            const tempQuaternion = new THREE__namespace.Quaternion();
            const defaultUp = new THREE__namespace.Vector3(0, 1, 0);

            return function(position, up) {
                tempQuaternion.setFromUnitVectors(defaultUp, up);
                this.controlPlane.position.copy(position);
                this.controlPlane.quaternion.copy(tempQuaternion);
            };

        }();

        addDebugMeshes() {
            this.debugRoot = this.createDebugMeshes();
            this.secondaryDebugRoot = this.createSecondaryDebugMeshes();
            this.scene.add(this.debugRoot);
            this.scene.add(this.secondaryDebugRoot);
        }

        createDebugMeshes(renderOrder) {
            const sphereGeometry = new THREE__namespace.SphereGeometry(1, 32, 32);
            const debugMeshRoot = new THREE__namespace.Object3D();

            const createMesh = (color, position) => {
                let sphereMesh = new THREE__namespace.Mesh(sphereGeometry, SceneHelper.buildDebugMaterial(color));
                sphereMesh.renderOrder = renderOrder;
                debugMeshRoot.add(sphereMesh);
                sphereMesh.position.fromArray(position);
            };

            createMesh(0xff0000, [-50, 0, 0]);
            createMesh(0xff0000, [50, 0, 0]);
            createMesh(0x00ff00, [0, 0, -50]);
            createMesh(0x00ff00, [0, 0, 50]);
            createMesh(0xffaa00, [5, 0, 5]);

            return debugMeshRoot;
        }

        createSecondaryDebugMeshes(renderOrder) {
            const boxGeometry = new THREE__namespace.BoxGeometry(3, 3, 3);
            const debugMeshRoot = new THREE__namespace.Object3D();

            let boxColor = 0xBBBBBB;
            const createMesh = (position) => {
                let boxMesh = new THREE__namespace.Mesh(boxGeometry, SceneHelper.buildDebugMaterial(boxColor));
                boxMesh.renderOrder = renderOrder;
                debugMeshRoot.add(boxMesh);
                boxMesh.position.fromArray(position);
            };

            let separation = 10;
            createMesh([-separation, 0, -separation]);
            createMesh([-separation, 0, separation]);
            createMesh([separation, 0, -separation]);
            createMesh([separation, 0, separation]);

            return debugMeshRoot;
        }

        static buildDebugMaterial(color) {
            const vertexShaderSource = `
            #include <common>
            varying float ndcDepth;

            void main() {
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position.xyz, 1.0);
                ndcDepth = gl_Position.z / gl_Position.w;
                gl_Position.x = gl_Position.x / gl_Position.w;
                gl_Position.y = gl_Position.y / gl_Position.w;
                gl_Position.z = 0.0;
                gl_Position.w = 1.0;
    
            }
        `;

            const fragmentShaderSource = `
            #include <common>
            uniform vec3 color;
            varying float ndcDepth;
            void main() {
                gl_FragDepth = (ndcDepth + 1.0) / 2.0;
                gl_FragColor = vec4(color.rgb, 0.0);
            }
        `;

            const uniforms = {
                'color': {
                    'type': 'v3',
                    'value': new THREE__namespace.Color(color)
                },
            };

            const material = new THREE__namespace.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertexShaderSource,
                fragmentShader: fragmentShaderSource,
                transparent: false,
                depthTest: true,
                depthWrite: true,
                side: THREE__namespace.FrontSide
            });
            material.extensions.fragDepth = true;

            return material;
        }

        static buildFocusMarkerMaterial(color) {
            const vertexShaderSource = `
            #include <common>

            uniform vec2 viewport;
            uniform vec3 realFocusPosition;

            varying vec4 ndcPosition;
            varying vec4 ndcCenter;
            varying vec4 ndcFocusPosition;

            void main() {
                float radius = 0.01;

                vec4 viewPosition = modelViewMatrix * vec4(position.xyz, 1.0);
                vec4 viewCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

                vec4 viewFocusPosition = modelViewMatrix * vec4(realFocusPosition, 1.0);

                ndcPosition = projectionMatrix * viewPosition;
                ndcPosition = ndcPosition * vec4(1.0 / ndcPosition.w);
                ndcCenter = projectionMatrix * viewCenter;
                ndcCenter = ndcCenter * vec4(1.0 / ndcCenter.w);

                ndcFocusPosition = projectionMatrix * viewFocusPosition;
                ndcFocusPosition = ndcFocusPosition * vec4(1.0 / ndcFocusPosition.w);

                gl_Position = projectionMatrix * viewPosition;

            }
        `;

            const fragmentShaderSource = `
            #include <common>
            uniform vec3 color;
            uniform vec2 viewport;
            uniform float opacity;

            varying vec4 ndcPosition;
            varying vec4 ndcCenter;
            varying vec4 ndcFocusPosition;

            void main() {
                vec2 screenPosition = vec2(ndcPosition) * viewport;
                vec2 screenCenter = vec2(ndcCenter) * viewport;

                vec2 screenVec = screenPosition - screenCenter;

                float projectedRadius = length(screenVec);

                float lineWidth = 0.0005 * viewport.y;
                float aaRange = 0.0025 * viewport.y;
                float radius = 0.06 * viewport.y;
                float radDiff = abs(projectedRadius - radius) - lineWidth;
                float alpha = 1.0 - clamp(radDiff / 5.0, 0.0, 1.0); 

                gl_FragColor = vec4(color.rgb, alpha * opacity);
            }
        `;

            const uniforms = {
                'color': {
                    'type': 'v3',
                    'value': new THREE__namespace.Color(color)
                },
                'realFocusPosition': {
                    'type': 'v3',
                    'value': new THREE__namespace.Vector3()
                },
                'viewport': {
                    'type': 'v2',
                    'value': new THREE__namespace.Vector2()
                },
                'opacity': {
                    'value': 0.0
                }
            };

            const material = new THREE__namespace.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertexShaderSource,
                fragmentShader: fragmentShaderSource,
                transparent: true,
                depthTest: false,
                depthWrite: false,
                side: THREE__namespace.FrontSide
            });

            return material;
        }
    }

    const VectorRight = new THREE__namespace.Vector3(1, 0, 0);
    const VectorUp = new THREE__namespace.Vector3(0, 1, 0);
    const VectorBackward = new THREE__namespace.Vector3(0, 0, 1);

    class Ray {

        constructor(origin = new THREE__namespace.Vector3(), direction = new THREE__namespace.Vector3()) {
            this.origin = new THREE__namespace.Vector3();
            this.direction = new THREE__namespace.Vector3();
            this.setParameters(origin, direction);
        }

        setParameters(origin, direction) {
            this.origin.copy(origin);
            this.direction.copy(direction).normalize();
        }

        boxContainsPoint(box, point, epsilon) {
            return point.x < box.min.x - epsilon || point.x > box.max.x + epsilon ||
                   point.y < box.min.y - epsilon || point.y > box.max.y + epsilon ||
                   point.z < box.min.z - epsilon || point.z > box.max.z + epsilon ? false : true;
        }

        intersectBox = function() {

            const planeIntersectionPoint = new THREE__namespace.Vector3();
            const planeIntersectionPointArray = [];
            const originArray = [];
            const directionArray = [];

            return function(box, outHit) {

                originArray[0] = this.origin.x;
                originArray[1] = this.origin.y;
                originArray[2] = this.origin.z;
                directionArray[0] = this.direction.x;
                directionArray[1] = this.direction.y;
                directionArray[2] = this.direction.z;

                if (this.boxContainsPoint(box, this.origin, 0.0001)) {
                    if (outHit) {
                        outHit.origin.copy(this.origin);
                        outHit.normal.set(0, 0, 0);
                        outHit.distance = -1;
                    }
                    return true;
                }

                for (let i = 0; i < 3; i++) {
                    if (directionArray[i] == 0.0) continue;

                    const hitNormal = i == 0 ? VectorRight : i == 1 ? VectorUp : VectorBackward;
                    const extremeVec = directionArray[i] < 0 ? box.max : box.min;
                    let multiplier = -Math.sign(directionArray[i]);
                    planeIntersectionPointArray[0] = i == 0 ? extremeVec.x : i == 1 ? extremeVec.y : extremeVec.z;
                    let toSide = planeIntersectionPointArray[0] - originArray[i];

                    if (toSide * multiplier < 0) {
                        const idx1 = (i + 1) % 3;
                        const idx2 = (i + 2) % 3;
                        planeIntersectionPointArray[2] = directionArray[idx1] / directionArray[i] * toSide + originArray[idx1];
                        planeIntersectionPointArray[1] = directionArray[idx2] / directionArray[i] * toSide + originArray[idx2];
                        planeIntersectionPoint.set(planeIntersectionPointArray[i],
                                                   planeIntersectionPointArray[idx2],
                                                   planeIntersectionPointArray[idx1]);
                        if (this.boxContainsPoint(box, planeIntersectionPoint, 0.0001)) {
                            if (outHit) {
                                outHit.origin.copy(planeIntersectionPoint);
                                outHit.normal.copy(hitNormal).multiplyScalar(multiplier);
                                outHit.distance = planeIntersectionPoint.sub(this.origin).length();
                            }
                            return true;
                        }
                    }
                }

                return false;
            };

        }();

        intersectSphere = function() {

            const toSphereCenterVec = new THREE__namespace.Vector3();

            return function(center, radius, outHit) {
                toSphereCenterVec.copy(center).sub(this.origin);
                const toClosestApproach = toSphereCenterVec.dot(this.direction);
                const toClosestApproachSq = toClosestApproach * toClosestApproach;
                const toSphereCenterSq = toSphereCenterVec.dot(toSphereCenterVec);
                const diffSq = toSphereCenterSq - toClosestApproachSq;
                const radiusSq = radius * radius;

                if (diffSq > radiusSq) return false;

                const thc = Math.sqrt(radiusSq - diffSq);
                const t0 = toClosestApproach - thc;
                const t1 = toClosestApproach + thc;

                if (t1 < 0) return false;
                let t = t0 < 0 ? t1 : t0;

                if (outHit) {
                    outHit.origin.copy(this.origin).addScaledVector(this.direction, t);
                    outHit.normal.copy(outHit.origin).sub(center).normalize();
                    outHit.distance = t;
                }
                return true;
            };

        }();
    }

    class Hit {

        constructor() {
            this.origin = new THREE__namespace.Vector3();
            this.normal = new THREE__namespace.Vector3();
            this.distance = 0;
        }

        set(origin, normal, distance) {
            this.origin.copy(origin);
            this.normal.copy(normal);
            this.distance = distance;
        }

        clone() {
            const hitClone = new Hit();
            hitClone.origin.copy(this.origin);
            hitClone.normal.copy(this.normal);
            hitClone.distance = this.distance;
            return hitClone;
        }

    }

    class Raycaster {

        constructor(origin, direction) {
            this.ray = new Ray(origin, direction);
        }

        setFromCameraAndScreenPosition = function() {

            const ndcCoords = new THREE__namespace.Vector2();

            return function(camera, screenPosition, screenDimensions) {
                ndcCoords.x = screenPosition.x / screenDimensions.x * 2.0 - 1.0;
                ndcCoords.y = (screenDimensions.y - screenPosition.y) / screenDimensions.y * 2.0 - 1.0;
                if (camera.isPerspectiveCamera) {
                    this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
                    this.ray.direction.set(ndcCoords.x, ndcCoords.y, 0.5 ).unproject(camera).sub(this.ray.origin).normalize();
                    this.camera = camera;
                } else if (camera.isOrthographicCamera) {
                    this.ray.origin.set(screenPosition.x, screenPosition.y,
                                       (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
                    this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
                    this.camera = camera;
                } else {
                    throw new Error('Raycaster::setFromCameraAndScreenPosition() -> Unsupported camera type');
                }
            };

        }();

        intersectSplatMesh = function() {

            const toLocal = new THREE__namespace.Matrix4();
            const fromLocal = new THREE__namespace.Matrix4();
            const localRay = new Ray();

            return function(splatMesh, outHits = []) {
                fromLocal.copy(splatMesh.matrixWorld);
                toLocal.copy(fromLocal).invert();
                localRay.origin.copy(this.ray.origin).applyMatrix4(toLocal);
                localRay.direction.copy(this.ray.direction).transformDirection(toLocal);

                const splatTree = splatMesh.getSplatTree();
                if (splatTree.rootNode) {
                    this.castRayAtSplatTreeNode(localRay, splatTree, splatTree.rootNode, outHits);
                }
                outHits.sort((a, b) => {
                    if (a.distance > b.distance) return 1;
                    else return -1;
                });
                outHits.forEach((hit) => {
                    hit.origin.applyMatrix4(fromLocal);
                    hit.normal.transformDirection(fromLocal);
                });
                return outHits;
            };

        }();

        castRayAtSplatTreeNode = function() {

            const tempCenter = new THREE__namespace.Vector3();
            const tempScale = new THREE__namespace.Vector3();
            const tempRotation = new THREE__namespace.Quaternion();
            const tempHit = new Hit();
            const scaleEpsilon = 0.0000001;

            // Used for raycasting against splat ellipsoid
            /*
            const origin = new THREE.Vector3(0, 0, 0);
            const tempRotationMatrix = new THREE.Matrix4();
            const tempScaleMatrix = new THREE.Matrix4();
            const toSphereSpace = new THREE.Matrix4();
            const fromSphereSpace = new THREE.Matrix4();
            const tempRay = new Ray();
            */

            return function(ray, splatTree, node, outHits = []) {
                if (!ray.intersectBox(node.boundingBox)) {
                    return;
                }
                if (node.data.indexes && node.data.indexes.length > 0) {
                    for (let i = 0; i < node.data.indexes.length; i++) {
                        const splatIndex = node.data.indexes[i];
                        splatTree.splatBuffer.getCenter(splatIndex, tempCenter);
                        splatTree.splatBuffer.getRotation(splatIndex, tempRotation);
                        splatTree.splatBuffer.getScale(splatIndex, tempScale);

                        if (tempScale.x <= scaleEpsilon || tempScale.y <= scaleEpsilon || tempScale.z <= scaleEpsilon) {
                            continue;
                        }

                        // Simple approximated sphere intersection
                        const radius = (tempScale.x + tempScale.y + tempScale.z) / 3;
                        if (ray.intersectSphere(tempCenter, radius, tempHit)) {
                            outHits.push(tempHit.clone());
                        }

                        // Raycast against actual splat ellipsoid ... doesn't actually work as well
                        // as the approximated sphere approach
                        /*
                        tempScaleMatrix.makeScale(tempScale.x, tempScale.y, tempScale.z);
                        tempRotationMatrix.makeRotationFromQuaternion(tempRotation);
                        fromSphereSpace.copy(tempScaleMatrix).premultiply(tempRotationMatrix);
                        toSphereSpace.copy(fromSphereSpace).invert();
                        tempRay.origin.copy(this.ray.origin).sub(tempCenter).applyMatrix4(toSphereSpace);
                        tempRay.direction.copy(this.ray.direction).transformDirection(toSphereSpace).normalize();
                        if (tempRay.intersectSphere(origin, 1.0, tempHit)) {
                            const hitClone = tempHit.clone();
                            hitClone.origin.applyMatrix4(fromSphereSpace).add(tempCenter);
                            outHits.push(hitClone);
                        }
                        */

                    }
                 }
                if (node.children && node.children.length > 0) {
                    for (let child of node.children) {
                        this.castRayAtSplatTreeNode(ray, splatTree, child, outHits);
                    }
                }
                return outHits;
            };

        }();
    }

    let idGen = 0;

    class SplatTreeNode {

        constructor(min, max, depth, id) {
            this.min = new THREE__namespace.Vector3().copy(min);
            this.max = new THREE__namespace.Vector3().copy(max);
            this.boundingBox = new THREE__namespace.Box3(this.min, this.max);
            this.center = new THREE__namespace.Vector3().copy(this.max).sub(this.min).multiplyScalar(0.5).add(this.min);
            this.depth = depth;
            this.children = [];
            this.data = null;
            this.id = id || idGen++;
        }

    }

    class SplatTree {

        constructor(maxDepth, maxCentersPerNode) {
            this.maxDepth = maxDepth;
            this.maxCentersPerNode = maxCentersPerNode;
            this.splatBuffer = null;
            this.sceneDimensions = new THREE__namespace.Vector3();
            this.sceneMin = new THREE__namespace.Vector3();
            this.sceneMax = new THREE__namespace.Vector3();
            this.rootNode = null;
            this.addedIndexes = {};
            this.nodesWithIndexes = [];
        }

        processSplatBuffer(splatBuffer, filterFunc = () => true) {
            this.splatBuffer = splatBuffer;
            this.addedIndexes = {};
            this.nodesWithIndexes = [];
            const splatCount = splatBuffer.getSplatCount();

            const center = new THREE__namespace.Vector3();
            for (let i = 0; i < splatCount; i++) {
                if (filterFunc(i)) {
                    splatBuffer.getCenter(i, center);
                    if (i === 0 || center.x < this.sceneMin.x) this.sceneMin.x = center.x;
                    if (i === 0 || center.x > this.sceneMax.x) this.sceneMax.x = center.x;
                    if (i === 0 || center.y < this.sceneMin.y) this.sceneMin.y = center.y;
                    if (i === 0 || center.y > this.sceneMax.y) this.sceneMax.y = center.y;
                    if (i === 0 || center.z < this.sceneMin.z) this.sceneMin.z = center.z;
                    if (i === 0 || center.z > this.sceneMax.z) this.sceneMax.z = center.z;
                }
            }

            this.sceneDimensions.copy(this.sceneMin).sub(this.sceneMin);

            const indexes = [];
            for (let i = 0; i < splatCount; i ++) {
                if (filterFunc(i)) {
                    indexes.push(i);
                }
            }
            this.rootNode = new SplatTreeNode(this.sceneMin, this.sceneMax, 0);
            this.rootNode.data = {
                'indexes': indexes
            };
            this.processNode(this.rootNode, splatBuffer);
        }

        processNode(node, splatBuffer) {
            const splatCount = node.data.indexes.length;

            if (splatCount < this.maxCentersPerNode || node.depth > this.maxDepth) {
                const newIndexes = [];
                for (let i = 0; i < node.data.indexes.length; i++) {
                    if (!this.addedIndexes[node.data.indexes[i]]) {
                        newIndexes.push(node.data.indexes[i]);
                        this.addedIndexes[node.data.indexes[i]] = true;
                    }
                }
                node.data.indexes = newIndexes;
                this.nodesWithIndexes.push(node);
                return;
            }

            const nodeDimensions = new THREE__namespace.Vector3().copy(node.max).sub(node.min);
            const halfDimensions = new THREE__namespace.Vector3().copy(nodeDimensions).multiplyScalar(0.5);

            const nodeCenter = new THREE__namespace.Vector3().copy(node.min).add(halfDimensions);

            const childrenBounds = [
                // top section, clockwise from upper-left (looking from above, +Y)
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x - halfDimensions.x, nodeCenter.y, nodeCenter.z - halfDimensions.z),
                               new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y + halfDimensions.y, nodeCenter.z)),
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z - halfDimensions.z),
                               new THREE__namespace.Vector3(nodeCenter.x + halfDimensions.x, nodeCenter.y + halfDimensions.y, nodeCenter.z)),
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z),
                               new THREE__namespace.Vector3(nodeCenter.x + halfDimensions.x,
                                                 nodeCenter.y + halfDimensions.y, nodeCenter.z + halfDimensions.z)),
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x - halfDimensions.x, nodeCenter.y, nodeCenter.z ),
                               new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y + halfDimensions.y, nodeCenter.z + halfDimensions.z)),

                // bottom section, clockwise from lower-left (looking from above, +Y)
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x - halfDimensions.x,
                                                 nodeCenter.y - halfDimensions.y, nodeCenter.z - halfDimensions.z),
                               new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z)),
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y - halfDimensions.y, nodeCenter.z - halfDimensions.z),
                               new THREE__namespace.Vector3(nodeCenter.x + halfDimensions.x, nodeCenter.y, nodeCenter.z)),
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y - halfDimensions.y, nodeCenter.z),
                               new THREE__namespace.Vector3(nodeCenter.x + halfDimensions.x, nodeCenter.y, nodeCenter.z + halfDimensions.z)),
                new THREE__namespace.Box3(new THREE__namespace.Vector3(nodeCenter.x - halfDimensions.x, nodeCenter.y - halfDimensions.y, nodeCenter.z),
                               new THREE__namespace.Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z + halfDimensions.z)),
            ];

            const splatCounts = [];
            const baseIndexes = [];
            for (let i = 0; i < childrenBounds.length; i++) {
                splatCounts[i] = 0;
                baseIndexes[i] = [];
            }

            const center = new THREE__namespace.Vector3();
            for (let i = 0; i < splatCount; i++) {
                const splatIndex = node.data.indexes[i];
                splatBuffer.getCenter(splatIndex, center);
                for (let j = 0; j < childrenBounds.length; j++) {
                    if (childrenBounds[j].containsPoint(center)) {
                        splatCounts[j]++;
                        baseIndexes[j].push(splatIndex);
                    }
                }
            }

            for (let i = 0; i < childrenBounds.length; i++) {
                const childNode = new SplatTreeNode(childrenBounds[i].min, childrenBounds[i].max, node.depth + 1);
                childNode.data = {
                    'indexes': baseIndexes[i]
                };
                node.children.push(childNode);
            }

            node.data = {};
            for (let child of node.children) {
                this.processNode(child, splatBuffer);
            }
        }


        countLeaves() {

            let leafCount = 0;
            this.visitLeaves(() => {
                leafCount++;
            });

            return leafCount;
        }

        visitLeaves(visitFunc) {

            const visitLeavesFromNode = (node, visitFunc) => {
                if (node.children.length === 0) visitFunc(node);
                for (let child of node.children) {
                    visitLeavesFromNode(child, visitFunc);
                }
            };

            return visitLeavesFromNode(this.rootNode, visitFunc);
        }

    }

    class SplatMesh extends THREE__namespace.Mesh {

        static buildMesh(splatBuffer, renderer, splatAlphaRemovalThreshold = 1, halfPrecisionCovariancesOnGPU = false,
                         devicePixelRatio = 1, enableDistancesComputationOnGPU = true) {
            const geometry = SplatMesh.buildGeomtery(splatBuffer);
            const material = SplatMesh.buildMaterial();
            return new SplatMesh(splatBuffer, geometry, material, renderer, splatAlphaRemovalThreshold,
                                 halfPrecisionCovariancesOnGPU, devicePixelRatio, enableDistancesComputationOnGPU);
        }

        constructor(splatBuffer, geometry, material, renderer, splatAlphaRemovalThreshold = 1,
                    halfPrecisionCovariancesOnGPU = false, devicePixelRatio = 1, enableDistancesComputationOnGPU = true) {
            super(geometry, material);
            this.splatBuffer = splatBuffer;
            this.geometry = geometry;
            this.material = material;
            this.renderer = renderer;
            this.splatTree = null;
            this.splatDataTextures = null;
            this.splatAlphaRemovalThreshold = splatAlphaRemovalThreshold;
            this.halfPrecisionCovariancesOnGPU = halfPrecisionCovariancesOnGPU;
            this.devicePixelRatio = devicePixelRatio;
            this.enableDistancesComputationOnGPU = enableDistancesComputationOnGPU;
            this.buildSplatTree();

            if (this.enableDistancesComputationOnGPU) {
                this.distancesTransformFeedback = {
                    'id': null,
                    'program': null,
                    'centersBuffer': null,
                    'outDistancesBuffer': null,
                    'centersLoc': -1,
                    'viewProjLoc': -1,
                };
                this.setupDistancesTransformFeedback();
            }

            this.resetLocalSplatDataAndTexturesFromSplatBuffer();
        }

        static buildMaterial() {

            const vertexShaderSource = `
            precision highp float;
            #include <common>

            attribute uint splatIndex;

            uniform highp sampler2D covariancesTexture;
            uniform highp usampler2D centersColorsTexture;
            uniform vec2 focal;
            uniform vec2 viewport;
            uniform vec2 basisViewport;
            uniform vec2 covariancesTextureSize;
            uniform vec2 centersColorsTextureSize;

            varying vec4 vColor;
            varying vec2 vUv;

            varying vec2 vPosition;

            const vec4 encodeNorm4 = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);
            const uvec4 mask4 = uvec4(uint(0x000000FF), uint(0x0000FF00), uint(0x00FF0000), uint(0xFF000000));
            const uvec4 shift4 = uvec4(0, 8, 16, 24);
            vec4 uintToRGBAVec (uint u) {
               uvec4 urgba = mask4 & u;
               urgba = urgba >> shift4;
               vec4 rgba = vec4(urgba) * encodeNorm4;
               return rgba;
            }

            vec2 getDataUV(in int stride, in int offset, in vec2 dimensions) {
                vec2 samplerUV = vec2(0.0, 0.0);
                float d = float(splatIndex * uint(stride) + uint(offset)) / dimensions.x;
                samplerUV.y = float(floor(d)) / dimensions.y;
                samplerUV.x = fract(d);
                return samplerUV;
            }

            void main () {
                uvec4 sampledCenterColor = texture(centersColorsTexture, getDataUV(1, 0, centersColorsTextureSize));
                vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));
                vColor = uintToRGBAVec(sampledCenterColor.r);

                vPosition = position.xy * 2.0;

                vec4 viewCenter = modelViewMatrix * vec4(splatCenter, 1.0);
                vec4 clipCenter = projectionMatrix * viewCenter;

                vec2 sampledCovarianceA = texture(covariancesTexture, getDataUV(3, 0, covariancesTextureSize)).rg;
                vec2 sampledCovarianceB = texture(covariancesTexture, getDataUV(3, 1, covariancesTextureSize)).rg;
                vec2 sampledCovarianceC = texture(covariancesTexture, getDataUV(3, 2, covariancesTextureSize)).rg;

                vec3 cov3D_M11_M12_M13 = vec3(sampledCovarianceA.rg, sampledCovarianceB.r);
                vec3 cov3D_M22_M23_M33 = vec3(sampledCovarianceB.g, sampledCovarianceC.rg);

                // Compute the 2D covariance matrix from the upper-right portion of the 3D covariance matrix
                mat3 Vrk = mat3(
                    cov3D_M11_M12_M13.x, cov3D_M11_M12_M13.y, cov3D_M11_M12_M13.z,
                    cov3D_M11_M12_M13.y, cov3D_M22_M23_M33.x, cov3D_M22_M23_M33.y,
                    cov3D_M11_M12_M13.z, cov3D_M22_M23_M33.y, cov3D_M22_M23_M33.z
                );
                float s = 1.0 / (viewCenter.z * viewCenter.z);
                mat3 J = mat3(
                    focal.x / viewCenter.z, 0., -(focal.x * viewCenter.x) * s,
                    0., focal.y / viewCenter.z, -(focal.y * viewCenter.y) * s,
                    0., 0., 0.
                );
                mat3 W = transpose(mat3(modelViewMatrix));
                mat3 T = W * J;
                mat3 cov2Dm = transpose(T) * Vrk * T;
                cov2Dm[0][0] += 0.3;
                cov2Dm[1][1] += 0.3;

                // We are interested in the upper-left 2x2 portion of the projected 3D covariance matrix because
                // we only care about the X and Y values. We want the X-diagonal, cov2Dm[0][0],
                // the Y-diagonal, cov2Dm[1][1], and the correlation between the two cov2Dm[0][1]. We don't
                // need cov2Dm[1][0] because it is a symetric matrix.
                vec3 cov2Dv = vec3(cov2Dm[0][0], cov2Dm[0][1], cov2Dm[1][1]);

                vec3 ndcCenter = clipCenter.xyz / clipCenter.w;

                // We now need to solve for the eigen-values and eigen vectors of the 2D covariance matrix
                // so that we can determine the 2D basis for the splat. This is done using the method described
                // here: https://people.math.harvard.edu/~knill/teaching/math21b2004/exhibits/2dmatrices/index.html
                //
                // This is a different approach than in the original work at INRIA. In that work they compute the
                // max extents of the 2D covariance matrix in screen space to form an axis aligned bounding rectangle
                // which forms the geometry that is actually rasterized. They then use the inverse 2D covariance
                // matrix (called 'conic') to determine fragment opacity.
                float a = cov2Dv.x;
                float d = cov2Dv.z;
                float b = cov2Dv.y;
                float D = a * d - b * b;
                float trace = a + d;
                float traceOver2 = 0.5 * trace;
                float term2 = sqrt(trace * trace / 4.0 - D);
                float eigenValue1 = traceOver2 + term2;
                float eigenValue2 = max(traceOver2 - term2, 0.00); // prevent negative eigen value

                const float maxSplatSize = 1024.0;
                vec2 eigenVector1 = normalize(vec2(b, eigenValue1 - a));
                // since the eigen vectors are orthogonal, we derive the second one from the first
                vec2 eigenVector2 = vec2(eigenVector1.y, -eigenVector1.x);
                vec2 basisVector1 = eigenVector1 * min(sqrt(2.0 * eigenValue1), maxSplatSize);
                vec2 basisVector2 = eigenVector2 * min(sqrt(2.0 * eigenValue2), maxSplatSize);

                vec2 ndcOffset = vec2(vPosition.x * basisVector1 + vPosition.y * basisVector2) * basisViewport;

                gl_Position = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);
            }`;

            const fragmentShaderSource = `
            precision highp float;
            #include <common>

            uniform vec3 debugColor;

            varying vec4 vColor;
            varying vec2 vUv;

            varying vec2 vPosition;

            void main () {
                // compute the negative squared distance from the center of the splat to the
                // current fragment in the splat's local space.
                float A = -dot(vPosition, vPosition);
                if (A < -4.0) discard;
                vec3 color = vColor.rgb;
                A = exp(A) * vColor.a;
                gl_FragColor = vec4(color.rgb, A);
            }`;

            const uniforms = {
                'covariancesTexture': {
                    'type': 't',
                    'value': null
                },
                'centersColorsTexture': {
                    'type': 't',
                    'value': null
                },
                'focal': {
                    'type': 'v2',
                    'value': new THREE__namespace.Vector2()
                },
                'viewport': {
                    'type': 'v2',
                    'value': new THREE__namespace.Vector2()
                },
                'basisViewport': {
                    'type': 'v2',
                    'value': new THREE__namespace.Vector2()
                },
                'debugColor': {
                    'type': 'v3',
                    'value': new THREE__namespace.Color()
                },
                'covariancesTextureSize': {
                    'type': 'v2',
                    'value': new THREE__namespace.Vector2(1024, 1024)
                },
                'centersColorsTextureSize': {
                    'type': 'v2',
                    'value': new THREE__namespace.Vector2(1024, 1024)
                }
            };

            const material = new THREE__namespace.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertexShaderSource,
                fragmentShader: fragmentShaderSource,
                transparent: true,
                alphaTest: 1.0,
                blending: THREE__namespace.NormalBlending,
                depthTest: true,
                depthWrite: false,
                side: THREE__namespace.DoubleSide
            });

            return material;
        }

        static buildGeomtery(splatBuffer) {

            const splatCount = splatBuffer.getSplatCount();

            const baseGeometry = new THREE__namespace.BufferGeometry();
            baseGeometry.setIndex([0, 1, 2, 0, 2, 3]);

            const positionsArray = new Float32Array(4 * 3);
            const positions = new THREE__namespace.BufferAttribute(positionsArray, 3);
            baseGeometry.setAttribute('position', positions);
            positions.setXYZ(0, -1.0, -1.0, 0.0);
            positions.setXYZ(1, -1.0, 1.0, 0.0);
            positions.setXYZ(2, 1.0, 1.0, 0.0);
            positions.setXYZ(3, 1.0, -1.0, 0.0);
            positions.needsUpdate = true;

            const geometry = new THREE__namespace.InstancedBufferGeometry().copy(baseGeometry);

            const splatIndexArray = new Uint32Array(splatCount);
            const splatIndexes = new THREE__namespace.InstancedBufferAttribute(splatIndexArray, 1, false);
            splatIndexes.setUsage(THREE__namespace.DynamicDrawUsage);
            geometry.setAttribute('splatIndex', splatIndexes);

            geometry.instanceCount = splatCount;

            return geometry;
        }

        buildSplatTree() {

            this.splatTree = new SplatTree(10, 500);
            console.time('SplatTree build');
            const splatColor = new THREE__namespace.Vector4();
            this.splatTree.processSplatBuffer(this.splatBuffer, (splatIndex) => {
                this.splatBuffer.getColor(splatIndex, splatColor);
                return splatColor.w > this.splatAlphaRemovalThreshold;
            });
            console.timeEnd('SplatTree build');

            let leavesWithVertices = 0;
            let avgSplatCount = 0;
            let maxSplatCount = 0;
            let nodeCount = 0;

            this.splatTree.visitLeaves((node) => {
                const nodeSplatCount = node.data.indexes.length;
                if (nodeSplatCount > 0) {
                    avgSplatCount += nodeSplatCount;
                    maxSplatCount = Math.max(maxSplatCount, nodeSplatCount);
                    nodeCount++;
                    leavesWithVertices++;
                }
            });
            console.log(`SplatTree leaves: ${this.splatTree.countLeaves()}`);
            console.log(`SplatTree leaves with splats:${leavesWithVertices}`);
            avgSplatCount = avgSplatCount / nodeCount;
            console.log(`Avg splat count per node: ${avgSplatCount}`);
        }

        getSplatTree() {
            return this.splatTree;
        }

        resetLocalSplatDataAndTexturesFromSplatBuffer() {
            this.updateLocalSplatDataFromSplatBuffer();
            this.allocateAndStoreLocalSplatDataInTextures();
            if (this.enableDistancesComputationOnGPU) {
                this.updateCentersGPUBufferForDistancesComputation();
            }
        }

        updateLocalSplatDataFromSplatBuffer() {
            const splatCount = this.splatBuffer.getSplatCount();
            this.covariances = new Float32Array(splatCount * 6);
            this.colors = new Uint8Array(splatCount * 4);
            this.centers = new Float32Array(splatCount * 3);
            this.splatBuffer.fillCovarianceArray(this.covariances);
            this.splatBuffer.fillCenterArray(this.centers);
            this.splatBuffer.fillColorArray(this.colors);
        }

        allocateAndStoreLocalSplatDataInTextures() {
            const COVARIANCES_ELEMENTS_PER_TEXEL = 2;
            const CENTER_COLORS_ELEMENTS_PER_TEXEL = 4;
            const splatCount = this.splatBuffer.getSplatCount();

            const covariancesTextureSize = new THREE__namespace.Vector2(4096, 1024);
            while (covariancesTextureSize.x * covariancesTextureSize.y * COVARIANCES_ELEMENTS_PER_TEXEL < splatCount * 6) {
                covariancesTextureSize.y *= 2;
            }

            const centersColorsTextureSize = new THREE__namespace.Vector2(4096, 1024);
            while (centersColorsTextureSize.x * centersColorsTextureSize.y * CENTER_COLORS_ELEMENTS_PER_TEXEL < splatCount * 4) {
                centersColorsTextureSize.y *= 2;
            }

            let covariancesTexture;
            let paddedCovariances;
            if (this.halfPrecisionCovariancesOnGPU) {
                paddedCovariances = new Uint16Array(covariancesTextureSize.x * covariancesTextureSize.y * COVARIANCES_ELEMENTS_PER_TEXEL);
                for (let i = 0; i < this.covariances.length; i++) {
                    paddedCovariances[i] = THREE__namespace.DataUtils.toHalfFloat(this.covariances[i]);
                }
                covariancesTexture = new THREE__namespace.DataTexture(paddedCovariances, covariancesTextureSize.x,
                                                           covariancesTextureSize.y, THREE__namespace.RGFormat, THREE__namespace.HalfFloatType);
            } else {
                paddedCovariances = new Float32Array(covariancesTextureSize.x * covariancesTextureSize.y * COVARIANCES_ELEMENTS_PER_TEXEL);
                paddedCovariances.set(this.covariances);
                covariancesTexture = new THREE__namespace.DataTexture(paddedCovariances, covariancesTextureSize.x,
                                                           covariancesTextureSize.y, THREE__namespace.RGFormat, THREE__namespace.FloatType);
            }
            covariancesTexture.needsUpdate = true;
            this.material.uniforms.covariancesTexture.value = covariancesTexture;
            this.material.uniforms.covariancesTextureSize.value.copy(covariancesTextureSize);

            const paddedCenterColors = new Uint32Array(centersColorsTextureSize.x *
                                                       centersColorsTextureSize.y * CENTER_COLORS_ELEMENTS_PER_TEXEL);
            for (let c = 0; c < splatCount; c++) {
                const colorsBase = c * 4;
                const centersBase = c * 3;
                const centerColorsBase = c * 4;
                paddedCenterColors[centerColorsBase] = rgbaToInteger(this.colors[colorsBase], this.colors[colorsBase + 1],
                                                                     this.colors[colorsBase + 2], this.colors[colorsBase + 3]);
                paddedCenterColors[centerColorsBase + 1] = uintEncodedFloat(this.centers[centersBase]);
                paddedCenterColors[centerColorsBase + 2] = uintEncodedFloat(this.centers[centersBase + 1]);
                paddedCenterColors[centerColorsBase + 3] = uintEncodedFloat(this.centers[centersBase + 2]);
            }
            const centersColorsTexture = new THREE__namespace.DataTexture(paddedCenterColors, centersColorsTextureSize.x,
                                                               centersColorsTextureSize.y, THREE__namespace.RGBAIntegerFormat, THREE__namespace.UnsignedIntType);
            centersColorsTexture.internalFormat = 'RGBA32UI';
            centersColorsTexture.needsUpdate = true;
            this.material.uniforms.centersColorsTexture.value = centersColorsTexture;
            this.material.uniforms.centersColorsTextureSize.value.copy(centersColorsTextureSize);
            this.material.uniformsNeedUpdate = true;

            this.splatDataTextures = {
                'covariances': {
                    'data': paddedCovariances,
                    'texture': covariancesTexture,
                    'size': covariancesTextureSize
                },
                'centerColors': {
                    'data': paddedCenterColors,
                    'texture': centersColorsTexture,
                    'size': centersColorsTextureSize
                }
            };
        }

        updateSplatDataToDataTextures() {
            this.updateLocalCovarianceDataToDataTexture();
            this.updateLocalCenterColorDataToDataTexture();
        }

        updateLocalCovarianceDataToDataTexture() {
            this.splatDataTextures.covariances.data.set(this.covariances);
            this.splatDataTextures.covariances.texture.needsUpdate = true;
        }

        updateLocalCenterColorDataToDataTexture() {
            this.splatDataTextures.centerColors.data.set(this.centerColors);
            this.splatDataTextures.centerColors.texture.needsUpdate = true;
        }

        updateIndexes(indexes, renderSplatCount) {
            const geometry = this.geometry;

            geometry.attributes.splatIndex.set(indexes);
            geometry.attributes.splatIndex.needsUpdate = true;

            geometry.instanceCount = renderSplatCount;
        }

        updateUniforms = function() {

            const viewport = new THREE__namespace.Vector2();

            return function(renderDimensions, cameraFocalLengthX, cameraFocalLengthY) {
                const splatCount = this.splatBuffer.getSplatCount();
                if (splatCount > 0) {
                    viewport.set(renderDimensions.x * this.devicePixelRatio,
                                 renderDimensions.y * this.devicePixelRatio);
                    this.material.uniforms.viewport.value.copy(viewport);
                    this.material.uniforms.basisViewport.value.set(2.0 / viewport.x, 2.0 / viewport.y);
                    this.material.uniforms.focal.value.set(cameraFocalLengthX, cameraFocalLengthY);
                    this.material.uniformsNeedUpdate = true;
                }
            };

        }();

        getSplatDataTextures() {
            return this.splatDataTextures;
        }

        getSplatCount() {
            return this.splatBuffer.getSplatCount();
        }

        getCenters() {
            return this.centers;
        }

        getColors() {
            return this.colors;
        }

        getCovariances() {
            return this.covariances;
        }

        setupDistancesTransformFeedback() {

            const splatCount = this.getSplatCount();

            const createShader = (gl, type, source) => {
                const shader = gl.createShader(type);
                if (!shader) {
                    console.error('Fatal error: gl could not create a shader object.');
                    return null;
                }

                gl.shaderSource(shader, source);
                gl.compileShader(shader);

                const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
                if (!compiled) {
                    let typeName = 'unknown';
                    if (type === gl.VERTEX_SHADER) typeName = 'vertex shader';
                    else if (type === gl.FRAGMENT_SHADER) typeName = 'fragement shader';
                    const errors = gl.getShaderInfoLog(shader);
                    console.error('Failed to compile ' + typeName + ' with these errors:' + errors);
                    gl.deleteShader(shader);
                    return null;
                }

                return shader;
            };

            const vsSource =
               `#version 300 es
            in ivec3 center;
            uniform ivec3 viewProj;
            flat out int distance;
            void main(void) {
                distance = center.x * viewProj.x + center.y * viewProj.y + center.z * viewProj.z; 
            }
        `;

            const fsSource =
               `#version 300 es
            precision lowp float;
            out vec4 fragColor;
            void main(){}
        `;

            const gl = this.renderer.getContext();

            const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

            this.distancesTransformFeedback.vao = gl.createVertexArray();
            gl.bindVertexArray(this.distancesTransformFeedback.vao);

            this.distancesTransformFeedback.program = gl.createProgram();
            const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
            const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
            if (!vertexShader || !fragmentShader) {
                throw new Error('Could not compile shaders for distances computation on GPU.');
            }
            gl.attachShader(this.distancesTransformFeedback.program, vertexShader);
            gl.attachShader(this.distancesTransformFeedback.program, fragmentShader);
            gl.transformFeedbackVaryings(this.distancesTransformFeedback.program, ['distance'], gl.SEPARATE_ATTRIBS);
            gl.linkProgram(this.distancesTransformFeedback.program);

            const linked = gl.getProgramParameter(this.distancesTransformFeedback.program, gl.LINK_STATUS);
            if (!linked) {
                const error = gl.getProgramInfoLog(program);
                console.error('Fatal error: Failed to link program: ' + error);
                gl.deleteProgram(this.distancesTransformFeedback.program);
                gl.deleteShader(fragmentShader);
                gl.deleteShader(vertexShader);
                throw new Error('Could not link shaders for distances computation on GPU.');
            }

            gl.useProgram(this.distancesTransformFeedback.program);

            this.distancesTransformFeedback.centersLoc = gl.getAttribLocation(this.distancesTransformFeedback.program, 'center');
            this.distancesTransformFeedback.viewProjLoc = gl.getUniformLocation(this.distancesTransformFeedback.program, 'viewProj');

            this.distancesTransformFeedback.centersBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.centersBuffer);
            gl.enableVertexAttribArray(this.distancesTransformFeedback.centersLoc);
            gl.vertexAttribIPointer(this.distancesTransformFeedback.centersLoc, 3, gl.INT, 0, 0);

            this.distancesTransformFeedback.outDistancesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.outDistancesBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, splatCount * 4, gl.DYNAMIC_DRAW);

            this.distancesTransformFeedback.id = gl.createTransformFeedback();
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.distancesTransformFeedback.id);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.distancesTransformFeedback.outDistancesBuffer);

            if (currentVao) gl.bindVertexArray(currentVao);

        }

        getIntegerCenters(padFour) {
            const splatCount = this.getSplatCount();
            const floatCenters = new Float32Array(this.centers);
            let intCenters;
            let componentCount = padFour ? 4 : 3;
            intCenters = new Int32Array(splatCount * componentCount);
            for (let i = 0; i < splatCount; i++) {
                for (let t = 0; t < 3; t++) {
                    intCenters[i * componentCount + t] = Math.round(floatCenters[i * 3 + t] * 1000.0);
                }
                if (padFour) intCenters[i * componentCount + 3] = 1;
            }
            return intCenters;
        }

        getIntegerMatrixArray(matrix) {
            const matrixElements = matrix.elements;
            const intMatrixArray = [];
            for (let i = 0; i < 16; i++) {
                intMatrixArray[i] = Math.round(matrixElements[i] * 1000.0);
            }
            return intMatrixArray;
        }

        updateCentersGPUBufferForDistancesComputation() {
            const gl = this.renderer.getContext();

            const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
            gl.bindVertexArray(this.distancesTransformFeedback.vao);

            const intCenters = this.getIntegerCenters(false);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.centersBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, intCenters, gl.STATIC_DRAW);

            if (currentVao) gl.bindVertexArray(currentVao);
        }

        computeDistancesOnGPU(viewProjMatrix, outComputedDistances) {

            const iViewProjMatrix = this.getIntegerMatrixArray(viewProjMatrix);
            const iViewProj = [iViewProjMatrix[2], iViewProjMatrix[6], iViewProjMatrix[10]];

            // console.time("gpu_compute_distances");
            const gl = this.renderer.getContext();

            const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
            const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);

            gl.bindVertexArray(this.distancesTransformFeedback.vao);
            gl.useProgram(this.distancesTransformFeedback.program);

            gl.enable(gl.RASTERIZER_DISCARD);

            gl.uniform3i(this.distancesTransformFeedback.viewProjLoc, iViewProj[0], iViewProj[1], iViewProj[2]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.centersBuffer);
            gl.enableVertexAttribArray(this.distancesTransformFeedback.centersLoc);
            gl.vertexAttribIPointer(this.distancesTransformFeedback.centersLoc, 3, gl.INT, 0, 0);

            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.distancesTransformFeedback.id);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.distancesTransformFeedback.outDistancesBuffer);

            gl.beginTransformFeedback(gl.POINTS);
            gl.drawArrays(gl.POINTS, 0, this.getSplatCount());
            gl.endTransformFeedback();

            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.outDistancesBuffer);
            gl.getBufferSubData(gl.ARRAY_BUFFER, 0, outComputedDistances);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            gl.disable(gl.RASTERIZER_DISCARD);

            // console.timeEnd("gpu_compute_distances");

            if (currentProgram) gl.useProgram(currentProgram);
            if (currentVao) gl.bindVertexArray(currentVao);

        }
    }

    var SorterWasm = "AGFzbQEAAAAADAZkeWxpbmsAAAAAAAEXA2AAAGAMf39/f39/f39/f39/AGAAAX8CEgEDZW52Bm1lbW9yeQIDAICABAMEAwABAgc5AxFfX3dhc21fY2FsbF9jdG9ycwAAC3NvcnRJbmRleGVzAAETZW1zY3JpcHRlbl90bHNfaW5pdAACCtUEAwMAAQvJBAICewJ9IAkgCGshCgJAIAsEQEH4////ByELQYiAgIB4IQggCSAKTQ0BIAohBQNAIAMgBUECdCIBaiACIAAgAWooAgBBAnRqKAIAIgE2AgAgASALIAEgC0gbIQsgASAIIAEgCEobIQggBUEBaiIFIAlHDQALDAELQfj///8HIQtBiICAgHghCCAJIApNDQAgBUEoaiAFQRhqIAX9CQII/VYCAAH9VgIAAiENIAohBQNAIAMgBUECdCICaiABIAAgAmooAgBBBHRq/QAAACAN/bUBIgz9GwAgDP0bAWogDP0bAmoiAjYCACACIAsgAiALSBshCyACIAggAiAIShshCCAFQQFqIgUgCUcNAAsLIAkgCksEQCAHQQFrsyAIsiALspOVIQ4gCiEIA0ACfyAOIAMgCEECdGoiASgCACALa7KUIg+LQwAAAE9dBEAgD6gMAQtBgICAgHgLIQUgASAFNgIAIAQgBUECdGoiASABKAIAQQFqNgIAIAhBAWoiCCAJRw0ACwsgB0ECTwRAIAQoAgAhCEEBIQsDQCAEIAtBAnRqIgEgASgCACAIaiIINgIAIAtBAWoiCyAHRw0ACwsgCkEASgRAIAohCwNAIAYgC0EBayIBQQJ0IgJqIAAgAmooAgA2AgAgC0EBSiECIAEhCyACDQALCyAJIApKBEAgCSELA0AgBiAJIAQgAyALQQFrIgtBAnQiAWooAgBBAnRqIgIoAgAiBWtBAnRqIAAgAWooAgA2AgAgAiAFQQFrNgIAIAogC0gNAAsLCwQAQQAL";

    class Constants {

        static DepthMapRange = 1 << 16;
        static MemoryPageSize = 65536;
        static BytesPerFloat = 4;
        static BytesPerInt = 4;

    }

    function sortWorker(self) {

        let wasmInstance;
        let wasmMemory;
        let splatCount;
        let indexesToSortOffset;
        let sortedIndexesOffset;
        let precomputedDistancesOffset;
        let mappedDistancesOffset;
        let frequenciesOffset;
        let centersOffset;
        let viewProjOffset;
        let countsZero;

        let Constants;

        function sort(splatSortCount, splatRenderCount, viewProj, usePrecomputedDistances) {
            const sortStartTime = performance.now();
            if (!countsZero) countsZero = new Uint32Array(Constants.DepthMapRange);
            new Int32Array(wasmMemory, viewProjOffset, 16).set(viewProj);
            new Uint32Array(wasmMemory, frequenciesOffset, Constants.DepthMapRange).set(countsZero);
            wasmInstance.exports.sortIndexes(indexesToSortOffset, centersOffset, precomputedDistancesOffset,
                                             mappedDistancesOffset, frequenciesOffset, viewProjOffset,
                                             sortedIndexesOffset, Constants.DepthMapRange, splatSortCount,
                                             splatRenderCount, splatCount, usePrecomputedDistances);
            const sortEndTime = performance.now();

            self.postMessage({
                'sortDone': true,
                'splatSortCount': splatSortCount,
                'splatRenderCount': splatRenderCount,
                'sortTime': sortEndTime - sortStartTime
            });
        }

        self.onmessage = (e) => {
            if (e.data.centers) {
                centers = e.data.centers;
                new Int32Array(wasmMemory, centersOffset, splatCount * 4).set(new Int32Array(centers));
                self.postMessage({
                    'sortSetupComplete': true,
                });
            } else if (e.data.sort) {
                const renderCount = e.data.sort.splatRenderCount || 0;
                const sortCount = e.data.sort.splatSortCount || 0;
                sort(sortCount, renderCount, e.data.sort.viewProj, e.data.sort.usePrecomputedDistances);
            } else if (e.data.init) {
                // Yep, this is super hacky and gross :(
                Constants = e.data.init.Constants;

                splatCount = e.data.init.splatCount;

                const CENTERS_BYTES_PER_ENTRY = Constants.BytesPerInt * 4;

                const sorterWasmBytes = new Uint8Array(e.data.init.sorterWasmBytes);

                const memoryRequiredForIndexesToSort = splatCount * Constants.BytesPerInt;
                const memoryRequiredForCenters = splatCount * CENTERS_BYTES_PER_ENTRY;
                const memoryRequiredForViewProjMatrix = 16 * Constants.BytesPerFloat;
                const memoryRequiredForPrecomputedDistances = splatCount * Constants.BytesPerInt;
                const memoryRequiredForMappedDistances = splatCount * Constants.BytesPerInt;
                const memoryRequiredForSortedIndexes = splatCount * Constants.BytesPerInt;
                const memoryRequiredForIntermediateSortBuffers = Constants.DepthMapRange * Constants.BytesPerInt * 2;
                const extraMemory = Constants.MemoryPageSize * 32;

                const totalRequiredMemory = memoryRequiredForIndexesToSort +
                                            memoryRequiredForCenters +
                                            memoryRequiredForViewProjMatrix +
                                            memoryRequiredForPrecomputedDistances +
                                            memoryRequiredForMappedDistances +
                                            memoryRequiredForSortedIndexes +
                                            memoryRequiredForIntermediateSortBuffers +
                                            extraMemory;
                const totalPagesRequired = Math.floor(totalRequiredMemory / Constants.MemoryPageSize ) + 1;
                const sorterWasmImport = {
                    module: {},
                    env: {
                        memory: new WebAssembly.Memory({
                            initial: totalPagesRequired * 2,
                            maximum: totalPagesRequired * 4,
                            shared: true,
                        }),
                    }
                };
                WebAssembly.compile(sorterWasmBytes)
                .then((wasmModule) => {
                    return WebAssembly.instantiate(wasmModule, sorterWasmImport);
                })
                .then((instance) => {
                    wasmInstance = instance;
                    indexesToSortOffset = 0;
                    centersOffset = indexesToSortOffset + memoryRequiredForIndexesToSort;
                    viewProjOffset = centersOffset + memoryRequiredForCenters;
                    precomputedDistancesOffset = viewProjOffset + memoryRequiredForViewProjMatrix;
                    mappedDistancesOffset = precomputedDistancesOffset + memoryRequiredForPrecomputedDistances;
                    frequenciesOffset = mappedDistancesOffset + memoryRequiredForMappedDistances;
                    sortedIndexesOffset = frequenciesOffset + memoryRequiredForIntermediateSortBuffers;
                    wasmMemory = sorterWasmImport.env.memory.buffer;
                    self.postMessage({
                        'sortSetupPhase1Complete': true,
                        'indexesToSortBuffer': wasmMemory,
                        'indexesToSortOffset': indexesToSortOffset,
                        'sortedIndexesBuffer': wasmMemory,
                        'sortedIndexesOffset': sortedIndexesOffset,
                        'precomputedDistancesBuffer': wasmMemory,
                        'precomputedDistancesOffset': precomputedDistancesOffset
                    });
                });
            }
        };
    }

    function createSortWorker(splatCount) {
        const worker = new Worker(
            URL.createObjectURL(
                new Blob(['(', sortWorker.toString(), ')(self)'], {
                    type: 'application/javascript',
                }),
            ),
        );

        const sorterWasmBinaryString = atob(SorterWasm);
        const sorterWasmBytes = new Uint8Array(sorterWasmBinaryString.length);
        for (let i = 0; i < sorterWasmBinaryString.length; i++) {
            sorterWasmBytes[i] = sorterWasmBinaryString.charCodeAt(i);
        }

        worker.postMessage({
            'init': {
                'sorterWasmBytes': sorterWasmBytes.buffer,
                'splatCount': splatCount,
                // Super hacky
                'Constants': {
                    'BytesPerFloat': Constants.BytesPerFloat,
                    'BytesPerInt': Constants.BytesPerInt,
                    'DepthMapRange': Constants.DepthMapRange,
                    'MemoryPageSize': Constants.MemoryPageSize
                }
            }
        });
        return worker;
    }

    const THREE_CAMERA_FOV = 50;
    const MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT = .75;

    class Viewer {

        constructor(params = {}) {

            if (!params.cameraUp) params.cameraUp = [0, 1, 0];
            if (!params.initialCameraPosition) params.initialCameraPosition = [0, 10, 15];
            if (!params.initialCameraLookAt) params.initialCameraLookAt = [0, 0, 0];
            if (params.selfDrivenMode === undefined) params.selfDrivenMode = true;
            if (params.useBuiltInControls === undefined) params.useBuiltInControls = true;

            this.rootElement = params.rootElement;
            this.usingExternalCamera = params.camera ? true : false;
            this.usingExternalRenderer = params.renderer ? true : false;

            this.cameraUp = new THREE__namespace.Vector3().fromArray(params.cameraUp);
            this.initialCameraPosition = new THREE__namespace.Vector3().fromArray(params.initialCameraPosition);
            this.initialCameraLookAt = new THREE__namespace.Vector3().fromArray(params.initialCameraLookAt);

            this.scene = params.scene;
            this.renderer = params.renderer;
            this.camera = params.camera;
            this.useBuiltInControls = params.useBuiltInControls;
            this.controls = null;

            this.ignoreDevicePixelRatio = params.ignoreDevicePixelRatio || false;
            this.devicePixelRatio = this.ignoreDevicePixelRatio ? 1 : window.devicePixelRatio;

            this.selfDrivenMode = params.selfDrivenMode;
            this.selfDrivenUpdateFunc = this.selfDrivenUpdate.bind(this);

            this.gpuAcceleratedSort = params.gpuAcceleratedSort;
            if (this.gpuAcceleratedSort !== true && this.gpuAcceleratedSort !== false) {
                this.gpuAcceleratedSort = true;
            }

            this.showMeshCursor = false;
            this.showControlPlane = false;
            this.showInfo = false;

            this.sceneHelper = null;

            this.sortWorker = null;
            this.sortRunning = false;
            this.splatRenderCount = 0;
            this.sortWorkerIndexesToSort = null;
            this.sortWorkerSortedIndexes = null;
            this.sortWorkerPrecomputedDistances = null;

            this.splatMesh = null;

            this.selfDrivenModeRunning = false;
            this.splatRenderingInitialized = false;

            this.raycaster = new Raycaster();

            this.infoPanel = null;
            this.infoPanelCells = {};

            this.currentFPS = 0;
            this.lastSortTime = 0;

            this.previousCameraTarget = new THREE__namespace.Vector3();
            this.nextCameraTarget = new THREE__namespace.Vector3();

            this.mousePosition = new THREE__namespace.Vector2();
            this.mouseDownPosition = new THREE__namespace.Vector2();
            this.mouseDownTime = null;

            this.initialized = false;
            this.init();
        }

        init() {

            if (this.initialized) return;

            if (!this.rootElement && !this.usingExternalRenderer) {
                this.rootElement = document.createElement('div');
                this.rootElement.style.width = '100%';
                this.rootElement.style.height = '100%';
                document.body.appendChild(this.rootElement);
            }

            const renderDimensions = new THREE__namespace.Vector2();
            this.getRenderDimensions(renderDimensions);

            if (!this.usingExternalCamera) {
                this.camera = new THREE__namespace.PerspectiveCamera(THREE_CAMERA_FOV, renderDimensions.x / renderDimensions.y, 0.1, 500);
                this.camera.position.copy(this.initialCameraPosition);
                this.camera.lookAt(this.initialCameraLookAt);
                this.camera.up.copy(this.cameraUp).normalize();
            }

            if (!this.usingExternalRenderer) {
                this.renderer = new THREE__namespace.WebGLRenderer({
                    antialias: false,
                    precision: 'highp'
                });
                this.renderer.setPixelRatio(this.devicePixelRatio);
                this.renderer.autoClear = true;
                this.renderer.setClearColor(0.0, 0.0, 0.0, 0.0);
                this.renderer.setSize(renderDimensions.x, renderDimensions.y);
            }

            this.scene = this.scene || new THREE__namespace.Scene();
            this.sceneHelper = new SceneHelper(this.scene);
            this.sceneHelper.setupMeshCursor();
            this.sceneHelper.setupFocusMarker();
            this.sceneHelper.setupControlPlane();

            if (this.useBuiltInControls) {
                this.controls = new OrbitControls(this.camera, this.renderer.domElement);
                this.controls.listenToKeyEvents(window);
                this.controls.rotateSpeed = 0.5;
                this.controls.maxPolarAngle = Math.PI * .75;
                this.controls.minPolarAngle = 0.1;
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                this.controls.target.copy(this.initialCameraLookAt);
                this.rootElement.addEventListener('pointermove', this.onMouseMove.bind(this), false);
                this.rootElement.addEventListener('pointerdown', this.onMouseDown.bind(this), false);
                this.rootElement.addEventListener('pointerup', this.onMouseUp.bind(this), false);
                window.addEventListener('keydown', this.onKeyDown.bind(this), false);
            }

            if (!this.usingExternalRenderer) {
                const resizeObserver = new ResizeObserver(() => {
                    this.getRenderDimensions(renderDimensions);
                    this.renderer.setSize(renderDimensions.x, renderDimensions.y);
                });
                resizeObserver.observe(this.rootElement);
                this.rootElement.appendChild(this.renderer.domElement);
            }

            this.setupInfoPanel();

            this.loadingSpinner = new LoadingSpinner(null, this.rootElement);
            this.loadingSpinner.hide();

            this.initialized = true;
        }

        onKeyDown = function() {

            const forward = new THREE__namespace.Vector3();
            const tempMatrixLeft = new THREE__namespace.Matrix4();
            const tempMatrixRight = new THREE__namespace.Matrix4();

            return function(e) {
                forward.set(0, 0, -1);
                forward.transformDirection(this.camera.matrixWorld);
                tempMatrixLeft.makeRotationAxis(forward, Math.PI / 128);
                tempMatrixRight.makeRotationAxis(forward, -Math.PI / 128);
                switch (e.code) {
                    case 'ArrowLeft':
                        this.camera.up.transformDirection(tempMatrixLeft);
                    break;
                    case 'ArrowRight':
                        this.camera.up.transformDirection(tempMatrixRight);
                    break;
                    case 'KeyC':
                        this.showMeshCursor = !this.showMeshCursor;
                    break;
                    case 'KeyP':
                        this.showControlPlane = !this.showControlPlane;
                    break;
                    case 'KeyI':
                        this.showInfo = !this.showInfo;
                        if (this.showInfo) {
                            this.infoPanel.style.display = 'block';
                        } else {
                            this.infoPanel.style.display = 'none';
                        }
                    break;
                }
            };

        }();

        onMouseMove(mouse) {
            this.mousePosition.set(mouse.offsetX, mouse.offsetY);
        }

        onMouseDown() {
            this.mouseDownPosition.copy(this.mousePosition);
            this.mouseDownTime = getCurrentTime();
        }

        onMouseUp = function() {

            const renderDimensions = new THREE__namespace.Vector2();
            const clickOffset = new THREE__namespace.Vector2();
            const toNewFocalPoint = new THREE__namespace.Vector3();
            const outHits = [];

            return function(mouse) {
                clickOffset.copy(this.mousePosition).sub(this.mouseDownPosition);
                const mouseUpTime = getCurrentTime();
                const wasClick = mouseUpTime - this.mouseDownTime < 0.5 && clickOffset.length() < 2;
                if (!this.transitioningCameraTarget && wasClick) {
                    this.getRenderDimensions(renderDimensions);
                    outHits.length = 0;
                    this.raycaster.setFromCameraAndScreenPosition(this.camera, this.mousePosition, renderDimensions);
                    this.mousePosition.set(mouse.offsetX, mouse.offsetY);
                    this.raycaster.intersectSplatMesh(this.splatMesh, outHits);
                    if (outHits.length > 0) {
                        const intersectionPoint = outHits[0].origin;
                        toNewFocalPoint.copy(intersectionPoint).sub(this.camera.position);
                        if (toNewFocalPoint.length() > MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT) {
                            this.previousCameraTarget.copy(this.controls.target);
                            this.nextCameraTarget.copy(intersectionPoint);
                            this.transitioningCameraTarget = true;
                            this.transitioningCameraTargetStartTime = getCurrentTime();
                        }
                    }
                }
            };

        }();

        getRenderDimensions(outDimensions) {
            if (this.rootElement) {
                outDimensions.x = this.rootElement.offsetWidth;
                outDimensions.y = this.rootElement.offsetHeight;
            } else {
                this.renderer.getSize(outDimensions);
            }
        }

        setupInfoPanel() {
            this.infoPanel = document.createElement('div');
            this.infoPanel.style.position = 'absolute';
            this.infoPanel.style.padding = '10px';
            this.infoPanel.style.backgroundColor = '#cccccc';
            this.infoPanel.style.border = '#aaaaaa 1px solid';
            this.infoPanel.style.zIndex = 100;
            this.infoPanel.style.width = '375px';
            this.infoPanel.style.fontFamily = 'arial';
            this.infoPanel.style.fontSize = '10pt';
            this.infoPanel.style.textAlign = 'left';

            const layout = [
                ['Camera position', 'cameraPosition'],
                ['Camera look-at', 'cameraLookAt'],
                ['Camera up', 'cameraUp'],
                ['Cursor position', 'cursorPosition'],
                ['FPS', 'fps'],
                ['Render window', 'renderWindow'],
                ['Rendering:', 'renderSplatCount'],
                ['Sort time', 'sortTime']
            ];

            const infoTable = document.createElement('div');
            infoTable.style.display = 'table';

            for (let layoutEntry of layout) {
                const row = document.createElement('div');
                row.style.display = 'table-row';

                const labelCell = document.createElement('div');
                labelCell.style.display = 'table-cell';
                labelCell.style.width = '110px';
                labelCell.innerHTML = `${layoutEntry[0]}: `;

                const spacerCell = document.createElement('div');
                spacerCell.style.display = 'table-cell';
                spacerCell.style.width = '10px';
                spacerCell.innerHTML = ' ';

                const infoCell = document.createElement('div');
                infoCell.style.display = 'table-cell';
                infoCell.innerHTML = '';

                this.infoPanelCells[layoutEntry[1]] = infoCell;

                row.appendChild(labelCell);
                row.appendChild(spacerCell);
                row.appendChild(infoCell);

                infoTable.appendChild(row);
            }

            this.infoPanel.appendChild(infoTable);
            this.infoPanel.style.display = 'none';
            this.renderer.domElement.parentElement.prepend(this.infoPanel);
        }

        updateSplatMeshUniforms = function() {

            const renderDimensions = new THREE__namespace.Vector2();

            return function() {
                const splatCount = this.splatMesh.getSplatCount();
                if (splatCount > 0) {
                    this.getRenderDimensions(renderDimensions);
                    this.cameraFocalLengthX = this.camera.projectionMatrix.elements[0] *
                                              this.devicePixelRatio * renderDimensions.x * 0.45;
                                              this.cameraFocalLengthY = this.camera.projectionMatrix.elements[5] *
                                              this.devicePixelRatio * renderDimensions.y * 0.45;
                    this.splatMesh.updateUniforms(renderDimensions, this.cameraFocalLengthX, this.cameraFocalLengthY);
                }
            };

        }();

        loadFile(fileURL, options = {}) {
            if (options.position) options.position = new THREE__namespace.Vector3().fromArray(options.position);
            if (options.orientation) options.orientation = new THREE__namespace.Quaternion().fromArray(options.orientation);
            options.splatAlphaRemovalThreshold = options.splatAlphaRemovalThreshold || 1;
            options.halfPrecisionCovariancesOnGPU = !!options.halfPrecisionCovariancesOnGPU;
            if (options.showLoadingSpinner !== false) options.showLoadingSpinner = true;

            if (options.showLoadingSpinner) this.loadingSpinner.show();
            const downloadProgress = (percent, percentLabel) => {
                if (options.showLoadingSpinner) {
                    if (percent == 100) {
                        this.loadingSpinner.setMessage(`Download complete!`);
                    } else {
                        const suffix = percentLabel ? `: ${percentLabel}` : `...`;
                        this.loadingSpinner.setMessage(`Downloading${suffix}`);
                    }
                }
                if (options.onProgress) options.onProgress(percent, percentLabel, 'downloading');
            };

            return new Promise((resolve, reject) => {
                let fileLoadPromise;
                if (fileURL.endsWith('.splat')) {
                    fileLoadPromise = new SplatLoader().loadFromURL(fileURL, downloadProgress);
                } else if (fileURL.endsWith('.ply')) {
                    fileLoadPromise = new PlyLoader().loadFromURL(fileURL, downloadProgress, 0, options.splatAlphaRemovalThreshold);
                } else {
                    reject(new Error(`Viewer::loadFile -> File format not supported: ${fileURL}`));
                }
                fileLoadPromise
                .then((splatBuffer) => {
                    if (options.showLoadingSpinner) this.loadingSpinner.hide();
                    if (options.onProgress) options.onProgress(0, '0%', 'processing');
                    this.loadSplatBuffer(splatBuffer, options).then(() => {
                        if (options.onProgress) options.onProgress(100, '100%', 'processing');
                        resolve();
                    });
                })
                .catch((e) => {
                    reject(new Error(`Viewer::loadFile -> Could not load file ${fileURL}`));
                });
            });
        }

        loadSplatBuffer(splatBuffer, options) {
            if (options.showLoadingSpinner !== false) options.showLoadingSpinner = true;
            return new Promise((resolve) => {
                if (options.showLoadingSpinner) {
                    this.loadingSpinner.show();
                    this.loadingSpinner.setMessage(`Processing splats...`);
                }
                window.setTimeout(() => {
                    this.setupSplatMesh(splatBuffer, options.splatAlphaRemovalThreshold, options.position,
                                        options.orientation, options.halfPrecisionCovariancesOnGPU,
                                        this.devicePixelRatio, this.gpuAcceleratedSort);
                    this.setupSortWorker(splatBuffer).then(() => {
                        if (options.showLoadingSpinner) this.loadingSpinner.hide();
                        resolve();
                    });
                }, 1);
            });
        }

        setupSplatMesh(splatBuffer, splatAlphaRemovalThreshold = 1, position = new THREE__namespace.Vector3(), quaternion = new THREE__namespace.Quaternion(),
                       halfPrecisionCovariancesOnGPU = false, devicePixelRatio = 1, gpuAcceleratedSort = true) {
            const splatCount = splatBuffer.getSplatCount();
            console.log(`Splat count: ${splatCount}`);

            this.splatMesh = SplatMesh.buildMesh(splatBuffer, this.renderer, splatAlphaRemovalThreshold,
                                                 halfPrecisionCovariancesOnGPU, devicePixelRatio, gpuAcceleratedSort);
            this.splatMesh.position.copy(position);
            this.splatMesh.quaternion.copy(quaternion);
            this.splatMesh.frustumCulled = false;
            this.updateSplatMeshUniforms();

            this.splatRenderCount = splatCount;
        }

        setupSortWorker(splatBuffer) {
            return new Promise((resolve) => {
                const splatCount = splatBuffer.getSplatCount();
                this.sortWorker = createSortWorker(splatCount);
                this.sortWorker.onmessage = (e) => {
                    if (e.data.sortDone) {
                        this.sortRunning = false;
                        this.splatMesh.updateIndexes(this.sortWorkerSortedIndexes, e.data.splatRenderCount);
                        this.lastSortTime = e.data.sortTime;
                    } else if (e.data.sortCanceled) {
                        this.sortRunning = false;
                    } else if (e.data.sortSetupPhase1Complete) {
                        console.log('Sorting web worker WASM setup complete.');
                        this.sortWorker.postMessage({
                            'centers': this.splatMesh.getIntegerCenters(true).buffer
                        });
                        this.sortWorkerSortedIndexes = new Uint32Array(e.data.sortedIndexesBuffer,
                                                                       e.data.sortedIndexesOffset, splatBuffer.getSplatCount());
                        this.sortWorkerIndexesToSort = new Uint32Array(e.data.indexesToSortBuffer,
                                                                       e.data.indexesToSortOffset, splatBuffer.getSplatCount());
                        this.sortWorkerPrecomputedDistances = new Int32Array(e.data.precomputedDistancesBuffer,
                                                                             e.data.precomputedDistancesOffset, splatBuffer.getSplatCount());
                        for (let i = 0; i < splatCount; i++) this.sortWorkerIndexesToSort[i] = i;
                    } else if (e.data.sortSetupComplete) {
                        console.log('Sorting web worker ready.');
                        this.splatMesh.updateIndexes(this.sortWorkerSortedIndexes, splatBuffer.getSplatCount());
                        const splatDataTextures = this.splatMesh.getSplatDataTextures();
                        const covariancesTextureSize = splatDataTextures.covariances.size;
                        const centersColorsTextureSize = splatDataTextures.centerColors.size;
                        console.log('Covariances texture size: ' + covariancesTextureSize.x + ' x ' + covariancesTextureSize.y);
                        console.log('Centers/colors texture size: ' + centersColorsTextureSize.x + ' x ' + centersColorsTextureSize.y);
                        this.updateView(true, true);
                        this.splatRenderingInitialized = true;
                        resolve();
                    }
                };
            });
        }

        gatherSceneNodes = function() {

            const nodeRenderList = [];
            const tempVectorYZ = new THREE__namespace.Vector3();
            const tempVectorXZ = new THREE__namespace.Vector3();
            const tempVector = new THREE__namespace.Vector3();
            const tempMatrix4 = new THREE__namespace.Matrix4();
            const renderDimensions = new THREE__namespace.Vector3();
            const forward = new THREE__namespace.Vector3(0, 0, -1);

            const tempMax = new THREE__namespace.Vector3();
            const nodeSize = (node) => {
                return tempMax.copy(node.max).sub(node.min).length();
            };

            const MaximumDistanceToRender = 125;

            return function(gatherAllNodes) {

                this.getRenderDimensions(renderDimensions);
                const cameraFocalLength = (renderDimensions.y / 2.0) / Math.tan(this.camera.fov / 2.0 * THREE__namespace.MathUtils.DEG2RAD);
                const fovXOver2 = Math.atan(renderDimensions.x / 2.0 / cameraFocalLength);
                const fovYOver2 = Math.atan(renderDimensions.y / 2.0 / cameraFocalLength);
                const cosFovXOver2 = Math.cos(fovXOver2);
                const cosFovYOver2 = Math.cos(fovYOver2);
                tempMatrix4.copy(this.camera.matrixWorld).invert();
                tempMatrix4.multiply(this.splatMesh.matrixWorld);

                const splatTree = this.splatMesh.getSplatTree();
                let nodeRenderCount = 0;
                let splatRenderCount = 0;
                const nodeCount = splatTree.nodesWithIndexes.length;
                for (let i = 0; i < nodeCount; i++) {
                    const node = splatTree.nodesWithIndexes[i];
                    tempVector.copy(node.center).applyMatrix4(tempMatrix4);
                    const distanceToNode = tempVector.length();
                    tempVector.normalize();

                    tempVectorYZ.copy(tempVector).setX(0).normalize();
                    tempVectorXZ.copy(tempVector).setY(0).normalize();

                    const cameraAngleXZDot = forward.dot(tempVectorXZ);
                    const cameraAngleYZDot = forward.dot(tempVectorYZ);

                    const ns = nodeSize(node);
                    const outOfFovY = cameraAngleYZDot < (cosFovYOver2 - .6);
                    const outOfFovX = cameraAngleXZDot < (cosFovXOver2 - .6);
                    if (!gatherAllNodes && ((outOfFovX || outOfFovY || distanceToNode > MaximumDistanceToRender) && distanceToNode > ns)) {
                        continue;
                    }
                    splatRenderCount += node.data.indexes.length;
                    nodeRenderList[nodeRenderCount] = node;
                    node.data.distanceToNode = distanceToNode;
                    nodeRenderCount++;
                }

                nodeRenderList.length = nodeRenderCount;
                nodeRenderList.sort((a, b) => {
                    if (a.data.distanceToNode < b.data.distanceToNode) return -1;
                    else return 1;
                });

                this.splatRenderCount = splatRenderCount;
                let currentByteOffset = splatRenderCount * Constants.BytesPerInt;
                for (let i = 0; i < nodeRenderCount; i++) {
                    const node = nodeRenderList[i];
                    const windowSizeInts = node.data.indexes.length;
                    const windowSizeBytes = windowSizeInts * Constants.BytesPerInt;
                    let destView = new Uint32Array(this.sortWorkerIndexesToSort.buffer, currentByteOffset - windowSizeBytes, windowSizeInts);
                    destView.set(node.data.indexes);
                    currentByteOffset -= windowSizeBytes;
                }

            };

        }();

        start() {
            if (this.selfDrivenMode) {
                requestAnimationFrame(this.selfDrivenUpdateFunc);
                this.selfDrivenModeRunning = true;
            } else {
                throw new Error('Cannot start viewer unless it is in self driven mode.');
            }
        }

        stop() {
            if (this.selfDrivenMode && this.selfDrivenModeRunning) {
                cancelAnimationFrame();
                this.selfDrivenModeRunning = false;
            }
        }

        updateFPS = function() {

            let lastCalcTime = getCurrentTime();
            let frameCount = 0;

            return function() {
                const currentTime = getCurrentTime();
                const calcDelta = currentTime - lastCalcTime;
                if (calcDelta >= 1.0) {
                    this.currentFPS = frameCount;
                    frameCount = 0;
                    lastCalcTime = currentTime;
                } else {
                    frameCount++;
                }
            };

        }();

        updateForRendererSizeChanges = function() {

            const lastRendererSize = new THREE__namespace.Vector2();
            const currentRendererSize = new THREE__namespace.Vector2();

            return function() {
                this.renderer.getSize(currentRendererSize);
                if (currentRendererSize.x !== lastRendererSize.x || currentRendererSize.y !== lastRendererSize.y) {
                    if (!this.usingExternalCamera) {
                        this.camera.aspect = currentRendererSize.x / currentRendererSize.y;
                        this.camera.updateProjectionMatrix();
                    }
                    if (this.splatRenderingInitialized) {
                        this.updateSplatMeshUniforms();
                    }
                    lastRendererSize.copy(currentRendererSize);
                }
            };

        }();

        selfDrivenUpdate() {
            if (this.selfDrivenMode) {
                requestAnimationFrame(this.selfDrivenUpdateFunc);
            }
            this.update();
            this.render();
        }

        update() {
            if (this.controls) {
                this.controls.update();
            }
            this.updateView();
            this.updateForRendererSizeChanges();
            this.updateMeshCursor();
            this.updateFPS();
            this.timingSensitiveUpdates();
            this.updateInfo();
            this.updateControlPlane();
        }

        timingSensitiveUpdates = function() {

            let lastUpdateTime;

            return function() {
                const currentTime = getCurrentTime();
                if (!lastUpdateTime) lastUpdateTime = currentTime;
                const timeDelta = currentTime - lastUpdateTime;

                this.updateCameraTransition(currentTime);
                this.updateFocusMarker(timeDelta);

                lastUpdateTime = currentTime;
            };

        }();

        updateCameraTransition = function() {

            let tempCameraTarget = new THREE__namespace.Vector3();
            let toPreviousTarget = new THREE__namespace.Vector3();
            let toNextTarget = new THREE__namespace.Vector3();

            return function(currentTime) {
                if (this.transitioningCameraTarget) {
                    toPreviousTarget.copy(this.previousCameraTarget).sub(this.camera.position).normalize();
                    toNextTarget.copy(this.nextCameraTarget).sub(this.camera.position).normalize();
                    const rotationAngle = Math.acos(toPreviousTarget.dot(toNextTarget));
                    const rotationSpeed = rotationAngle / (Math.PI / 3) * .65 + .3;
                    const t = (rotationSpeed / rotationAngle * (currentTime - this.transitioningCameraTargetStartTime));
                    tempCameraTarget.copy(this.previousCameraTarget).lerp(this.nextCameraTarget, t);
                    this.camera.lookAt(tempCameraTarget);
                    this.controls.target.copy(tempCameraTarget);
                    if (t >= 1.0) {
                        this.transitioningCameraTarget = false;
                    }
                }
            };

        }();

        updateFocusMarker = function() {

            const renderDimensions = new THREE__namespace.Vector2();
            let wasTransitioning = false;

            return function(timeDelta) {
                this.getRenderDimensions(renderDimensions);
                const fadeInSpeed = 10.0;
                const fadeOutSpeed = 2.5;
                if (this.transitioningCameraTarget) {
                    this.sceneHelper.setFocusMarkerVisibility(true);
                    const currentFocusMarkerOpacity = Math.max(this.sceneHelper.getFocusMarkerOpacity(), 0.0);
                    let newFocusMarkerOpacity = Math.min(currentFocusMarkerOpacity + fadeInSpeed * timeDelta, 1.0);
                    this.sceneHelper.setFocusMarkerOpacity(newFocusMarkerOpacity);
                    this.sceneHelper.updateFocusMarker(this.nextCameraTarget, this.camera, renderDimensions);
                    wasTransitioning = true;
                } else {
                    let currentFocusMarkerOpacity;
                    if (wasTransitioning) currentFocusMarkerOpacity = 1.0;
                    else currentFocusMarkerOpacity = Math.min(this.sceneHelper.getFocusMarkerOpacity(), 1.0);
                    if (currentFocusMarkerOpacity > 0) {
                        this.sceneHelper.updateFocusMarker(this.nextCameraTarget, this.camera, renderDimensions);
                        let newFocusMarkerOpacity = Math.max(currentFocusMarkerOpacity - fadeOutSpeed * timeDelta, 0.0);
                        this.sceneHelper.setFocusMarkerOpacity(newFocusMarkerOpacity);
                        if (newFocusMarkerOpacity === 0.0) this.sceneHelper.setFocusMarkerVisibility(false);
                    }
                    wasTransitioning = false;
                }
            };

        }();

        updateMeshCursor = function() {

            const outHits = [];
            const renderDimensions = new THREE__namespace.Vector2();

            return function() {
                if (this.showMeshCursor) {
                    this.getRenderDimensions(renderDimensions);
                    outHits.length = 0;
                    this.raycaster.setFromCameraAndScreenPosition(this.camera, this.mousePosition, renderDimensions);
                    this.raycaster.intersectSplatMesh(this.splatMesh, outHits);
                    if (outHits.length > 0) {
                        this.sceneHelper.setMeshCursorVisibility(true);
                        this.sceneHelper.positionAndOrientMeshCursor(outHits[0].origin, this.camera);
                    } else {
                        this.sceneHelper.setMeshCursorVisibility(false);
                    }
                } else {
                    this.sceneHelper.setMeshCursorVisibility(false);
                }
            };

        }();

        updateInfo = function() {

            const renderDimensions = new THREE__namespace.Vector2();

            return function() {
                if (this.showInfo) {
                    const splatCount = this.splatMesh.getSplatCount();
                    this.getRenderDimensions(renderDimensions);

                    const cameraPos = this.camera.position;
                    const cameraPosString = `[${cameraPos.x.toFixed(5)}, ${cameraPos.y.toFixed(5)}, ${cameraPos.z.toFixed(5)}]`;
                    this.infoPanelCells.cameraPosition.innerHTML = cameraPosString;

                    const cameraLookAt = this.controls.target;
                    const cameraLookAtString = `[${cameraLookAt.x.toFixed(5)}, ${cameraLookAt.y.toFixed(5)}, ${cameraLookAt.z.toFixed(5)}]`;
                    this.infoPanelCells.cameraLookAt.innerHTML = cameraLookAtString;

                    const cameraUp = this.camera.up;
                    const cameraUpString = `[${cameraUp.x.toFixed(5)}, ${cameraUp.y.toFixed(5)}, ${cameraUp.z.toFixed(5)}]`;
                    this.infoPanelCells.cameraUp.innerHTML = cameraUpString;

                    if (this.showMeshCursor) {
                        const cursorPos = this.sceneHelper.meshCursor.position;
                        const cursorPosString = `[${cursorPos.x.toFixed(5)}, ${cursorPos.y.toFixed(5)}, ${cursorPos.z.toFixed(5)}]`;
                        this.infoPanelCells.cursorPosition.innerHTML = cursorPosString;
                    } else {
                        this.infoPanelCells.cursorPosition.innerHTML = 'N/A';
                    }

                    this.infoPanelCells.fps.innerHTML = this.currentFPS;
                    this.infoPanelCells.renderWindow.innerHTML = `${renderDimensions.x} x ${renderDimensions.y}`;

                    const renderPct = this.splatRenderCount / splatCount * 100;
                    this.infoPanelCells.renderSplatCount.innerHTML =
                        `${this.splatRenderCount} splats out of ${splatCount} (${renderPct.toFixed(2)}%)`;

                    this.infoPanelCells.sortTime.innerHTML = `${this.lastSortTime.toFixed(3)} ms`;
                }
            };

        }();

        updateControlPlane() {
            if (this.showControlPlane) {
                this.sceneHelper.setControlPlaneVisibility(true);
                this.sceneHelper.positionAndOrientControlPlane(this.controls.target, this.camera.up);
            } else {
                this.sceneHelper.setControlPlaneVisibility(false);
            }
        }

        render = function() {

            return function() {
                const hasRenderables = (scene) => {
                    for (let child of scene.children) {
                        if (child.visible) {
                        return true;
                        }
                    }
                    return false;
                };

                const savedAuoClear = this.renderer.autoClear;
                this.renderer.autoClear = false;
                if (hasRenderables(this.scene)) this.renderer.render(this.scene, this.camera);
                this.renderer.render(this.splatMesh, this.camera);
                if (this.sceneHelper.getFocusMarkerOpacity() > 0.0) this.renderer.render(this.sceneHelper.focusMarker, this.camera);
                if (this.showControlPlane) this.renderer.render(this.sceneHelper.controlPlane, this.camera);
                this.renderer.autoClear = savedAuoClear;
            };

        }();

        updateView = function() {

            const tempMatrix = new THREE__namespace.Matrix4();
            const cameraPositionArray = [];
            const lastSortViewDir = new THREE__namespace.Vector3(0, 0, -1);
            const sortViewDir = new THREE__namespace.Vector3(0, 0, -1);
            const lastSortViewPos = new THREE__namespace.Vector3();
            const sortViewOffset = new THREE__namespace.Vector3();
            const queuedTiers = [];

            const partialSorts = [
                {
                    'angleThreshold': 0.55,
                    'sortFractions': [0.125, 0.33333, 0.75]
                },
                {
                    'angleThreshold': 0.65,
                    'sortFractions': [0.33333, 0.66667]
                },
                {
                    'angleThreshold': 0.8,
                    'sortFractions': [0.5]
                }
            ];

            return function(force = false, gatherAllNodes = false) {
                let angleDiff = 0;
                let positionDiff = 0;
                sortViewDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
                let needsRefreshForRotation = false;
                let needsRefreshForPosition = false;
                angleDiff = sortViewDir.dot(lastSortViewDir);
                positionDiff = sortViewOffset.copy(this.camera.position).sub(lastSortViewPos).length();

                if (!force && queuedTiers.length === 0) {
                    if (angleDiff <= 0.95) needsRefreshForRotation = true;
                    if (positionDiff >= 1.0) needsRefreshForPosition = true;
                    if (!needsRefreshForRotation && !needsRefreshForPosition) return;
                }

                tempMatrix.copy(this.camera.matrixWorld).invert();
                tempMatrix.premultiply(this.camera.projectionMatrix);
                tempMatrix.multiply(this.splatMesh.matrixWorld);
                cameraPositionArray[0] = this.camera.position.x;
                cameraPositionArray[1] = this.camera.position.y;
                cameraPositionArray[2] = this.camera.position.z;

                if (!this.sortRunning) {
                    let sortCount;
                    this.sortRunning = true;
                    this.gatherSceneNodes(gatherAllNodes);
                    if (this.gpuAcceleratedSort && (queuedTiers.length <= 1 || queuedTiers.length % 2 === 0)) {
                        this.splatMesh.computeDistancesOnGPU(tempMatrix, this.sortWorkerPrecomputedDistances);
                    }
                    if (queuedTiers.length === 0) {
                        for (let partialSort of partialSorts) {
                            if (angleDiff < partialSort.angleThreshold) {
                                for (let sortFraction of partialSort.sortFractions) {
                                    queuedTiers.push(Math.floor(this.splatRenderCount * sortFraction));
                                }
                                break;
                            }
                        }
                        queuedTiers.push(this.splatRenderCount);
                    }
                    sortCount = Math.min(queuedTiers.shift(), this.splatRenderCount);
                    this.sortWorker.postMessage({
                        sort: {
                            'viewProj': this.splatMesh.getIntegerMatrixArray(tempMatrix),
                            'cameraPosition': cameraPositionArray,
                            'splatRenderCount': this.splatRenderCount,
                            'splatSortCount': sortCount,
                            'usePrecomputedDistances': this.gpuAcceleratedSort
                        }
                    });
                    if (queuedTiers.length === 0) {
                        lastSortViewPos.copy(this.camera.position);
                        lastSortViewDir.copy(sortViewDir);
                    }
                }
            };

        }();

        getSplatMesh() {
            return this.splatMesh;
        }
    }

    exports.PlyLoader = PlyLoader;
    exports.PlyParser = PlyParser;
    exports.SplatBuffer = SplatBuffer;
    exports.SplatLoader = SplatLoader;
    exports.Viewer = Viewer;

}));
//# sourceMappingURL=gaussian-splats-3d.umd.cjs.map
