// renovate: datasource=npm depName=@editframe/api versioning=npm
const EDITFRAME_API_VERSION = "^0.58.0";
// renovate: datasource=npm depName=@editframe/cli versioning=npm
const EDITFRAME_CLI_VERSION = "^0.58.0";
// renovate: datasource=npm depName=@editframe/create versioning=npm
const EDITFRAME_CREATE_VERSION = "^0.58.0";
// renovate: datasource=npm depName=@editframe/elements versioning=npm
const EDITFRAME_ELEMENTS_VERSION = "^0.58.0";
// renovate: datasource=npm depName=@editframe/react versioning=npm
const EDITFRAME_REACT_VERSION = "^0.58.0";

export const EDITFRAME_PACKAGE_VERSIONS = {
  "@editframe/api": EDITFRAME_API_VERSION,
  "@editframe/cli": EDITFRAME_CLI_VERSION,
  "@editframe/create": EDITFRAME_CREATE_VERSION,
  "@editframe/elements": EDITFRAME_ELEMENTS_VERSION,
  "@editframe/react": EDITFRAME_REACT_VERSION
} as const;
