const net = require('net'),
    http = require('http'),
    request = require('request'),
    xmljs = require('xml2js'),

    sockets = [],
    videoIds = [],

    ytApiKey = '', // https://console.developers.google.com/apis/credentials
    ytApiURL = 'https://www.googleapis.com/youtube/v3/videos?part=id%2C+snippet';

function ParseXML(xml) {
    xml = xmljs.parseString(xml, function(error, response) {
        if(!response.hasOwnProperty('feed')) return;
        if(!response.feed.hasOwnProperty('entry')) return;
        if(response.feed.entry.length == 0) return;
        let data = response.feed.entry[0],
            videoID = data['yt:videoId'][0],
            title = data['title'][0],
            author = data['author'][0].name[0];
        if(videoIds.indexOf(videoID) != -1) return;
        videoIds.push(videoID); // we dont care if its deleted, or edited
        request(ytApiURL+'&id='+videoID+'&key='+ytApiKey, function(err, res, body){
            if(err) console.log(err);
            body = JSON.parse(body) || {};
            if(!body.hasOwnProperty('items')) return;
            if(body.items.length == 0) return;
            let video = body.items[0].snippet,
                thumbnail = video.thumbnails.high.url,
                live = (video.liveBroadcastContent!='none'),
                description = video.description.substr(256),
                isLong = (video.description.length > 256);
            if(sockets.length == 0) return console.log('There are no active sockets');
            sockets.forEach(function(s) {
                s.write(JSON.stringify({
                    'videoID': videoID,
                    'title': title,
                    'author': author,
                    'thumbnail': thumbnail,
                    'description': description,
                    'isLive': live
                }));
            });
            console.log('Broadcasted new video to '+sockets.length+' sockets'+(live?' (live)':'.'));
        });
    });
}

function HttpListener(req, res) {
    let url = req.url;
    if(url.startsWith('/ytcallback')) {
        console.log('Incoming request');
        if(req.method == 'GET' && url.indexOf('hub.challenge=') != 0) {
            res.writeHead(200);
            res.end(url.split('hub.challenge=')[1].split('&')[0]);
        } else {
            var xml = '';
            req.on('data', function(data) { xml += data; });
            req.on('end', function() { ParseXML(xml); });
            res.writeHead(200);
            res.end();
        }
    }
}

function NetListener(socket) {
    let id = sockets.length;
    sockets[id] = socket;
    socket.on('close', function() {
        sockets.splice(id, 1);
        console.log('Socket #'+id+' disconnected');
    });
    console.log('Socket #'+id+' connected');
}

http.createServer(HttpListener).listen(8481);
net.createServer(NetListener).listen(8480);
