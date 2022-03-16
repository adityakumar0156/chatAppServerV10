//node server which will handle socket io connections
const io = require('socket.io')(process.env.PORT || 8000);
const request = require('request');
const users = {}; //socketId---Names
// let users_dp = {}; //socket ID ----usersDP
const userName = []; // All names
let rooms = {}; // socketId----roomVal

let peers = {}; // peerId------roomVal
let socPeer = {}; //socketId----peerId
let peerNames = {}; //peerId----names
let socid_anony = {}; //socketId---anonymous status
let peerNamesServer = {}; //peerId & Gender

let peerRoomGmailPrep = {};


io.on('connection', socket => {

    socket.on('preparing', (room, gmail) => {
        peerRoomGmailPrep[socket.id] = { room: room, gmail: gmail };
        request.post(
            'https://sunnychatv2.herokuapp.com/pushgmail', { json: { room: room, gmail: gmail } },
            function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log("/pushgmail:", body);
                }
            }
        );



    })

    socket.on("new-user-joined", (name, roomVal, peerId, dp, anony_status, desc, location, gmail, rname) => {
        //adding names in front end server
        request.post(
            'https://sunnychatv2.herokuapp.com/adduser', { json: { room: roomVal, dp: dp, name: name, key: peerId } },
            function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log("/adduser:", body);
                }
            }
        );



        //add gmail in front end server

        peers[peerId] = roomVal;
        socPeer[socket.id] = peerId;
        peerNames[peerId] = { name: name, dp: dp, desc: desc, anony: anony_status, loc: location, reaction: { support: 0, warn: 0, report: 0 }, msgCount: 0 };
        socid_anony[socket.id] = anony_status;
        // users_dp[peerId] = dp;
        peerNamesServer[peerId] = { realName: rname, gmail: gmail, gender: '' };



        request.get(
            `https://gender-api.com/get?name=${getFstName(peerNamesServer[peerId].realName)}&key=da54h6PNTYuujdd9gPAjxb48k2l26bleFEA6`,
            function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    // console.log(body);
                    peerNamesServer[peerId].gender = body.gender;
                }
            }
        );




        let peersInPartRoom = [];
        for (let key in peers) {
            if (peers.hasOwnProperty(key)) {
                if (roomVal == peers[key]) {
                    peersInPartRoom.push(key);
                }
                // console.log(key, value);
            }
        }

        let peerNamesInPartRoom = {};
        peersInPartRoom.forEach(id => {
            peerNamesInPartRoom[id] = peerNames[id];
        })


        socket.join(roomVal);
        users[socket.id] = name;
        rooms[socket.id] = roomVal;
        userName.push(name);

        let userInPartRoom = [];
        for (let key in rooms) {
            if (rooms.hasOwnProperty(key)) {
                if (roomVal == rooms[key]) {
                    userInPartRoom.push(users[key]);
                }
                // console.log(key, value);
            }
        }

        io.sockets.to(roomVal).emit('update-users', userInPartRoom, peersInPartRoom, peerNamesInPartRoom);
        socket.broadcast.to(roomVal).emit('user-joined', name, userInPartRoom, socket.id, peerId, anony_status, peerNamesInPartRoom, peersInPartRoom);
        console.log("user connected")
    });

    socket.on('send', (message, roomVal, type, msg_No) => {
        io.sockets.to(roomVal).emit('recieve', { message: message, name: users[socket.id], type: type, peerId: socPeer[socket.id], dp: peerNames[socPeer[socket.id]].dp, anonymous: socid_anony[socket.id], msg_No: msg_No })
    });

    socket.on('disconnect', (message) => {

        request.post(
            'https://sunnychatv2.herokuapp.com/removeuser', { json: { room: rooms[socket.id], key: socPeer[socket.id] } },
            function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log("/removeuser:", body);
                }
            }
        );

        //poping gmail from the front end server
        request.post(
            'https://sunnychatv2.herokuapp.com/removegmail', { json: { room: peerRoomGmailPrep[socket.id].room, gmail: peerRoomGmailPrep[socket.id].gmail } },
            function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log("/removegmail:", body);
                }
            }
        );
        delete peerRoomGmailPrep[socket.id];


        //pushing anony_chars into the foront server
        if (socid_anony[socket.id]) {
            console.log("anonymous disconnected");
            request.post(
                'https://sunnychatv2.herokuapp.com/pushchar', { json: { room: rooms[socket.id], name: users[socket.id] } },
                function(error, response, body) {
                    if (!error && response.statusCode == 200) {
                        console.log("/pushchar:", body);
                    }
                }
            );
        }

        const roomVal = rooms[socket.id];
        delete rooms[socket.id];
        delete peers[socPeer[socket.id]];
        delete peerNames[socPeer[socket.id]];
        delete socid_anony[socket.id];

        let peersInPartRoom = [];
        for (let key in peers) {
            if (peers.hasOwnProperty(key)) {
                if (roomVal == peers[key]) {
                    peersInPartRoom.push(key);
                }
                // console.log(key, value);
            }
        }


        let peerNamesInPartRoom = {};
        peersInPartRoom.forEach(id => {
            peerNamesInPartRoom[id] = peerNames[id];
        })


        let userInPartRoom = [];
        for (let key in rooms) {
            if (rooms.hasOwnProperty(key)) {
                if (roomVal == rooms[key]) {
                    userInPartRoom.push(users[key]);
                }
            }
        }

        const index = userName.indexOf(users[socket.id]);
        if (index > -1) {
            userName.splice(index, 1);
        }
        socket.broadcast.to(roomVal).emit('left', users[socket.id], userInPartRoom, peersInPartRoom, socPeer[socket.id], peerNamesInPartRoom);
        delete users[socket.id];
        delete socPeer[socket.id];
        console.log("user left");
    })
    socket.on('type', (name, roomVal) => {
        socket.broadcast.to(roomVal).emit('typing', users[socket.id]);
    });

    socket.on('stopsStreaming', (name, roomVal, peerId) => {
        socket.broadcast.to(roomVal).emit('printStopsStreaming', users[socket.id], peerId);

    })

    socket.on('support', (peerThis, peerOther, bool) => {
        console.log(peerOther)
        if (bool) {
            peerNames[peerOther].reaction.support += 1;
            io.sockets.to(peers[peerOther]).emit('supported', peerOther, peerThis, true);
        } else {
            peerNames[peerOther].reaction.support -= 1;
            io.sockets.to(peers[peerOther]).emit('supported', peerOther, peerThis, false);
        }

    })

    socket.on('warn', (peerThis, peerOther) => {
        peerNames[peerOther].reaction.warn += 1;
        io.sockets.to(peers[peerOther]).emit('warneded', peerOther, peerThis);

    })

    socket.on('report', (peerThis, peerOther, bool) => {

        if (bool) {
            peerNames[peerOther].reaction.report += 1;
            io.sockets.to(peers[peerOther]).emit('reported', peerOther, peerThis, true);
        } else {
            peerNames[peerOther].reaction.report -= 1;
            io.sockets.to(peers[peerOther]).emit('reported', peerOther, peerThis, false);
        }
        if (blockingCondition(peerOther, peers[peerOther])) {
            socket.broadcast.to(peers[peerOther]).emit('block', peerOther);
            //add gmail to blocked gmails of a particular room..
            //  . . . .
            request.post(
                'https://sunnychatv2.herokuapp.com/blockgmail', { json: { room: rooms[socket.id], gmail: peerNamesServer[peerOther].gmail } },
                function(error, response, body) {
                    if (!error && response.statusCode == 200) {
                        console.log("/blockgmail:", body);
                    }
                }
            );
        }
    })


});

const getFstName = (name) => {
    let str = name.trim();
    let arr = str.split(" ");
    str = arr[0];
    return str;
}
const blockingCondition = (peerid, room) => {
    let report_count = peerNames[peerid].reaction.report;
    let count = 0;
    for (let key in peers) {
        if (peers.hasOwnProperty(key)) {
            if (room == peers[key]) {
                count++;
            }
        }
    }
    if (report_count / count >= 0.25) {
        return true;
    } else return false;
}