const {app, BrowserWindow, Menu, ipcMain} = require('electron');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        title: 'Lighting Control onPC',
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.maximize();
    return mainWindow.loadFile("view/index.html").then(() => {
    })
}

app.whenReady().then(() => {
    return createWindow();
})
