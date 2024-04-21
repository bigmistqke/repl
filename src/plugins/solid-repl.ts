// import  from "@babel/parser"
export const solidReplPlugin = function ({ types }: { types: any }): babel.PluginObj {
  return {
    name: 'solid-repl-plugin',
    visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value === 'solid-js/web') {
          const renderSpecifier = path.node.specifiers.find(
            specifier =>
              types.isImportSpecifier(specifier) &&
              'imported' in specifier &&
              'name' in specifier.imported &&
              specifier.imported.name === 'render',
          )
          if (renderSpecifier) {
            path.scope.getBinding(renderSpecifier.local.name)!.path.node.isSolidJSWebRender = true
          }
        }
      },
      CallExpression(path) {
        if (path.node.hasBeenTransformed) {
          return
        }

        const callee = path.node.callee
        // Check if the callee is 'render' imported from 'solid-js/web'
        if (
          types.isIdentifier(callee) &&
          'name' in callee &&
          path.scope.getBinding(callee.name)?.path?.node?.isSolidJSWebRender
        ) {
          const renderCall = types.callExpression(callee, path.node.arguments)
          const newAssignmentExpression = types.assignmentExpression(
            '=',
            types.memberExpression(types.identifier('window'), types.identifier('dispose')),
            renderCall,
          )
          renderCall.hasBeenTransformed = true
          path.replaceWith(newAssignmentExpression)
        }
      },
    },
  }
}
