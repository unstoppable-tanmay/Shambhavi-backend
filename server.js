const express = require('express');
const env = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
var cors = require('cors');

const app = express(); // creating a express server
const server = http.createServer(app); // creating a http server
app.use(cors());
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
}); // creating a Socket Server

env.config(); // config the env

const PORT = process.env.PORT || 3000; // Choosing a Port

var Drivers = new Map(); // Saving the Prev Updated Data 

const driver = io.of('/driver');  // Namespace For Driver
const traveller = io.of('/traveller');  // NameSpace For Traveller
const controller = io.of('/controller') // Namespace For Control Center

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Connection For Controll Center
controller.on('connection', (socket) => {
    console.log(`Control Center Connected...`);
    // Initial Data Transfer
    socket.emit('update', Array.from(Drivers, ([key, value]) => ({ key, value })));

    // Alert Control For Bus
    socket.on('alert-control', (payload) => {
        io.of('/driver').to(Drivers.get(payload.busnumber).id).emit('alert', payload.data)
    });
})

// Connection For Drivers
driver.on('connection', (socket) => {
    const busNumber = socket.handshake.query.busnumber; // The Bus Number Of Driver
    console.log(`Driver Connected📡 : ${busNumber}`);

    // If The Call Doesnot Contain Any BusNumber
    if (busNumber) {
        // Initial Setiing Of Bus Data
        Drivers.set(busNumber, { id: socket.id, prevdata: {
            "lat": 31.1048,
            "long": 77.1734
        }, aditional: {} });
    }
    else {
        // Error For Not Providing The busNo & Disconnect
        socket.emit('server-error', 'You are being disconnected due to a condition.');
        socket.disconnect(true)
    }
    // On Disconnection
    socket.on('disconnect', () => {
        console.log(`Driver Disconnected🚫 : ${busNumber}`);
    })
    // The Update Event Call From Driver
    socket.on('update', (payload) => {
        //  Adding The latest Data to the Driver
        Drivers.set(busNumber, { id: socket.id, prevdata: payload, aditional: {} });
        console.log(Drivers)
        // Emitting The Data to The Room Of that excat bus Travellers
        io.of('/traveller').to(busNumber).emit('update', payload)
        io.of('/controller').emit('update', Array.from(Drivers, ([key, value]) => ({ key, value })))
    })

    socket.on('ping', async () => {
        //  Adding The latest Data to the Driver
        for (let i = 0; i < 100; i++) {
            var payload = { lat: Drivers.get(busNumber).prevdata.lat + .0001, long: Drivers.get(busNumber).prevdata.long + .0001 }

            Drivers.set(busNumber, { id: socket.id, prevdata: payload, aditional: {} });
            console.log(Drivers)
            // Emitting The Data to The Room Of that excat bus Travellers
            io.of('/traveller').to(busNumber).emit('update', payload)
            io.of('/controller').emit('update', Array.from(Drivers, ([key, value]) => ({ key, value })))
            await sleep(700)
        }
    })
});

// Connection for Travellers
traveller.on('connection', (socket) => {
    console.log("traveller connected")
    const busNumber = socket.handshake.query.busnumber;
    // If They Does not Provide The busnnumber
    if (busNumber) {
        // If there is no bus now with provided busnumber
        if (Drivers.get(busNumber)) {
            // Joining them to a room named of that busnumber
            socket.join(busNumber)
            // Emiting the initial data to traveller
            socket.emit('update', Drivers.get(busNumber).prevdata)
        }
        // Error Due to no bus found
        else {
            socket.emit('server-error', 'Bus Is Not Found');
            socket.disconnect(true)
        }
    }
    // Disconnect due to not providing the busnumber
    else {
        socket.emit('server-error', 'You are being disconnected due not providing the bus-number');
        socket.disconnect(true)
    }
    // Alert System for ['women','lost-found','saftey']
    socket.on('alert', (payload) => {
        io.of('/driver').to(Drivers.get(busNumber).id).emit('alert', payload)
    })
});

// Server Started
server.listen(PORT, () => {
    console.log(`Bus 🚌 is Locating 📌 At ${PORT}`);
})