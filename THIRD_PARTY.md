# Third-party components

The OpenClaw adapter is built on the official [Plow OpenClaw base image](https://github.com/plow-pbc/plow-openclaw-agent), which supplies OpenClaw, the Plow channel and upstream usage reporting. These components retain their own terms; this repository's MIT license applies to its original code, not the base image or its dependencies.

The optional PDF generator uses ReportLab. Test execution uses Docker and Node.js images. Dependencies are not vendored here. The AUTOMACAO adapter includes only test doubles and assertions; the owner's private target repository and customer data are not included.
