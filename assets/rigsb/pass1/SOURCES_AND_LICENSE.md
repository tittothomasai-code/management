# Sources and licences

All exported mesh geometry, layouts, hazard markings and material definitions were authored procedurally for this package. No downloaded CAD, meshes, logos, photos, HDRIs or texture images are embedded in the GLBs. No Cyberloop or customer data is included.

Original geometry, generated model assets, screenshot compositions and generator source are dedicated under CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/ . To the extent a public-domain dedication is not effective, the author grants a perpetual, worldwide, royalty-free permission to use, modify, redistribute and sublicense these original assets for any purpose.

## Design references

- The requested rig list, part hierarchy, land-rig proportions, naming and coordinate convention came from the supplied brief.
- NOV's public land rig equipment overview was consulted for generic equipment context: https://www.nov.com/products/land-drilling-rigs .
- NOV's public top-drive equipment overview was consulted for generic assembly context: https://www.nov.com/products/top-drive-systems .
- These are generic visual interpretations. No manufacturer geometry, product logo or CAD data was copied, and no affiliation is implied.

## Rebuild and viewer software

Dependencies are fetched by `npm ci` and are not bundled as third-party assets. Their own licences continue to apply to the dependencies:

- three.js: MIT, https://github.com/mrdoob/three.js/blob/dev/LICENSE
- three-mesh-bvh: MIT, https://github.com/gkjohnson/three-mesh-bvh/blob/master/LICENSE
- glTF Transform: MIT, https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE
- Draco / draco3dgltf: Apache-2.0, https://github.com/google/draco/blob/main/LICENSE
- glTF Validator: Apache-2.0, https://github.com/KhronosGroup/glTF-Validator/blob/main/LICENSE
- Playwright: Apache-2.0, https://github.com/microsoft/playwright/blob/main/LICENSE

The local screenshot viewer uses the procedural RoomEnvironment shipped with three.js for lighting. This environment is not an external HDRI and is not embedded in the delivered GLBs. The generated screenshot files contain the original rig models, ground plane, lighting and labels.
