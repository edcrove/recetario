const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch workspace packages
config.watchFolders = [workspaceRoot]

// Resolve workspace packages from the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Remap .js imports to .ts files (NodeNext TypeScript compat)
const defaultResolver = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    const tsPath = moduleName.slice(0, -3) + '.ts'
    const tsxPath = moduleName.slice(0, -3) + '.tsx'
    try {
      return context.resolveRequest(context, tsPath, platform)
    } catch {
      try {
        return context.resolveRequest(context, tsxPath, platform)
      } catch {
        // fall through to default resolver
      }
    }
  }
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
