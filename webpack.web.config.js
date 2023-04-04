const path = require('path');
const webpack = require('webpack');

/** @typedef {import('webpack').Configuration} WebpackConfig **/
/** @type WebpackConfig */
const webExtensionConfig = {
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: 'webworker', // extensions run in a webworker context
  entry: {
    extension: './src/extension.ts', // source of the web extension main file
    //'test/suite/index': './src/web/test/suite/index.ts' // source of the web extension test runner
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, './dist/web'),
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]'
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
    extensions: ['.ts', '.js'], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      assert: require.resolve('assert')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'esbuild-loader',
        options: {
          loader: 'ts',
          target: 'es2015'
        }
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser' // provide a shim for the global `process` variable
    })
  ],
  externals: {
    vscode: 'commonjs vscode', // ignored because it doesn't exist
    'applicationinsights-native-metrics': 'commonjs applicationinsights-native-metrics', // ignored because we don't ship native module
    '@opentelemetry/tracing': 'commonjs @opentelemetry/tracing', // ignored because we don't ship this module
    '@opentelemetry/instrumentation': 'commonjs @opentelemetry/instrumentation', // ignored because we don't ship this module
    '@azure/opentelemetry-instrumentation-azure-sdk': 'commonjs @azure/opentelemetry-instrumentation-azure-sdk', // ignored because we don't ship this module
    '@azure/functions-core': 'commonjs @azure/functions-core' 
  },
  performance: {
    hints: false
  },
  devtool: 'nosources-source-map' // create a source map that points to the original source file
};
module.exports = [webExtensionConfig];
