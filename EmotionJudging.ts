import express = require('express');
import routes = require('./routes/index');
import user = require('./routes/user');
import wx = require('./wx/wxUnit');
import wxcpt = require('./wx/wxComponents');
import st = require('./scheduleTask/scheduleUnit');
import path = require('path');
import http = require('http');
import com = require('./commonUnit/commonUnit');
const xmlparser = require('express-xml-bodyparser');

//-------------------------------------------------unit Init---------------------------------------------//
//微信模块初始化
wx.wxMgrInitance.Init();
wx.wxMgrInitance.isVerification = true;
//绑定文本信息
wx.wxMgrInitance.replyText = (message,callback) =>
{
    com.httpGetRequest('some ip address', `/v1/api/sendtextmessageSync?ID=${message.fromusername}&LID=0&text=${encodeURIComponent(message.content)}`, 3000, { "Content-Length": 0 }, (data) => {
        console.log(data);
            try {
                let dataObj = JSON.parse(data);
                let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': dataObj[0].instruct.txt };
                callback(res);
            }
            catch (e) {
                let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': '服务器出来点问题' };
                callback(res);
            }
        });
}
//绑定音频信息
wx.wxMgrInitance.replyVoice = (message, callback) => {
    com.httpGetRequest('some ip address', `/v1/api/sendtextmessageSync?ID=${message.fromusername}&LID=0&text=${encodeURIComponent(message.recognition)}`, 3000, { "Content-Length": 0 }, (data) => {
        try {
            let dataObj = JSON.parse(data);
            let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': dataObj.instruct.txt };
            callback(res);
        }
        catch (e) {
            let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': '服务器出来点问题' };
            callback(res);
        }
    });
}

interface IFaceRes
{
    err: string;
    identifyFaces: Object[];
}

//绑定图片信息
wx.wxMgrInitance.replyImage = (message, callback) => {
    com.httpPostRequest('another ip address', '/Imgrec/api/v1/detectAndidentify', 9292, "POST", { "Content-Type": "application/json", "Content-Length": 0 } as any, JSON.stringify({ "groupId": "dev1", "url": message.picurl }), (data) => {
        let faces: IFaceRes = JSON.parse(data);
        if (null== faces.err) {
            for (let i = 0; i < faces.identifyFaces.length;i++)
            {
                if (faces.identifyFaces[i]["candidates"][0]["confidence"] > 0.7) {
                    let personId: string = faces.identifyFaces[i]["candidates"][0]["personId"]
                    com.httpGetRequest('another ip address',
                        '/Imgrec/api/v1/groups/dev1/persons/' + personId,
                        9292,
                        { "Content-Length": 0 },
                        (data1) => {
                            com.httpPostRequest('another ip address', '/Imgrec/api/v1/recognize', 9292, "POST", { "Content-Type": "application/json", "Content-Length": 0 } as any, JSON.stringify({ "url": message.picurl }), (data2) => {
                                    let person = JSON.parse(data1);
                                    let emotion = JSON.parse(data2);
                                    if ("happiness" == emotion["recognize"][0]["topEmotion"]["emotion"]) {
                                        let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': person["person"]["name"] + "今天有什么开心的事情吗" };
                                        callback(res);
                                    }
                                    else if ("sadness" == emotion["recognize"][0]["topEmotion"]["emotion"])
                                    {
                                        let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': person["person"]["name"] + "心情不好嘛，我会一直陪着你的" };
                                        callback(res);
                                    }
                                    else {
                                        let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': person["person"]["name"] + "你好" };
                                        callback(res);
                                    }
                                });
                        });
                }
                else
                {
                    let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': data };
                    callback(res);
                }

            }
        }
        else
        {
            let res = { ToUserName: message.fromusername, FromUserName: message.tousername, CreateTime: Date.now(), MsgType: "text", 'Content': data };
            callback(res);
        }

    });
}
//周期任务模块初始化
st.ScheduleTaskMgr_.Init();
//----------------------------------------------------------------------------------------------//
var app = express();
// all environments
app.set('port', process.env.PORT || 80);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(xmlparser({ explicitArray: false }))
//app.use(express.methodOverride());
app.use(app.router);
import stylus = require('stylus');
app.use(stylus.middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);


app.get('/wx/access', user.wxaccess);
//-------------------------------------------------Post---------------------------------------------//
app.post('/wx/access', user.wxreceiver);

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
