# Conference React example application

This example shows how to integrate Flashphoner [WebCallServer](https://flashphoner.com) Javascript API ([WebSDK](https://www.npmjs.com/package/@flashphoner/websdk)) to React application 

## How to build

In the project directory, you can run:

### `npm install`

Installs all the dependencies needed.

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React and WebSDK in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

## How to deploy

Copy build folder content to a web server, for example
```
mkdir -p /var/www/html/conference-react
cp -r build/* /var/www/html/conference-react
```

Then you can open example page in browser `https://yourhost/conference-react/index.html`

Please note that you should open page via secure connection in browser for WebRTC to work, except localhost.
