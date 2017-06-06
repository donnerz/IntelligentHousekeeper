import redisHelper = require("../DBH/RedisHelper");
import enumclass = require("../Enum");
import http = require("http");
import https = require("https");
import action = require("../Action/Action");
import INTENT = require("../Intent/NewIntent");
import pl = require("../platformConfig")
import Sf = require("./Speechfilter");

//我们的luis的返回的结果接口
export interface IBLZLUISRes {
    text: string
    score: number
    intent: string
    entities: Ientity[]
}

//微软的luis的返回的结果接口
export interface IMLUISRes {
    query: string
    topScoringIntent: {
        score: number
        intent: string
    };
    entities: Ientity[]
}

//LUIS返回的统一的接口
export interface ILUISRes {
    intent: Iintent
    entities: Object; //{"家电":Ientity[],"城市":Ientity[]}
}

export interface Iintent {
    MainIntent: string;
    score: number;
}

export interface Ientity {
    entity: string;
    type: string;
    resolution: Object;
    isNew: number; //表示此实体是不是新的
}

export interface IAIAgentData {
    //ID  机器人唯一的标识 一个家庭一个
    ID: string;
    //CID 角色对应的ID
    CID: number;
    //Lisnter ID 监听者的ID
    LID: string;
    //当前语句
    query: string;
    //当前知识库回答语句
    answer: string;
    //客户端请求时间
    time: string;
    //打印流程的时间
    logTime: Object[];
}

export class AIAgentData implements IAIAgentData {
    ID: string = null;
    CID: number = null;
    LID: string = null;
    query: string = null;
    answer: string = null;
    time: string = null;
    logTime: Object[] = [];
}

let noneRes = [
    '抱歉，我不理解', '我好像不明白', '我不能够理解', '我开小差了'
];


export class LUISRes implements ILUISRes {
    public intent: Iintent = { MainIntent: null, score: null };
    public entities: Object = {};
}

class AIAgent {
    // =========================================================流程化的处理=========================================================
    private LUISIndex = pl.platformConfig_.Config.isLUIS;
    //接到的文本感知并且处理
    public GetTextTouch(_AIAgentData: IAIAgentData) {
        if (0 == this.LUISIndex) {
            this.GetBLZLUISData(_AIAgentData, (BLZLUISData: ILUISRes) => {
                this.OnGetIntentEnd(_AIAgentData, BLZLUISData);
            });
        }
        else if (1 == this.LUISIndex) {
            this.GetLUISData(_AIAgentData, (LUISData: ILUISRes) => {
                this.OnGetIntentEnd(_AIAgentData, LUISData);
            });
        }
        else if (2 == this.LUISIndex) {
            this.GetBLZLUISData(_AIAgentData, (LUISData: ILUISRes) => {
                if ("None" == LUISData.intent.MainIntent) {
                    this.GetLUISData(_AIAgentData, (LUISData: ILUISRes) => {
                        this.OnGetIntentEnd(_AIAgentData, LUISData);
                    });
                }
                else
                {
                    this.OnGetIntentEnd(_AIAgentData, LUISData);
                }
            });
        }
    }
    //接到的文本感知并且处理同步
    public GetTextTouchSync(_AIAgentData: IAIAgentData, callback: (res: string) => void)
    {
        if (0 == this.LUISIndex) {
            this.GetBLZLUISData(_AIAgentData, (BLZLUISData: ILUISRes) => {
                this.OnGetIntentEndSync(_AIAgentData, BLZLUISData, callback);
            });
        }
        else if (1 == this.LUISIndex) {
            this.GetLUISData(_AIAgentData, (LUISData: ILUISRes) => {
                this.OnGetIntentEndSync(_AIAgentData, LUISData, callback);
            });
        }
        else if (2 == this.LUISIndex) {
            this.GetBLZLUISData(_AIAgentData, (LUISData: ILUISRes) => {
                if ("None" == LUISData.intent.MainIntent)
                {
                    this.GetLUISData(_AIAgentData, (LUISData: ILUISRes) => {
                        this.OnGetIntentEndSync(_AIAgentData, LUISData, callback);
                    });
                }
                else {
                    this.OnGetIntentEndSync(_AIAgentData, LUISData, callback);
                }
            });
        }
    }

    //接到的意图对象后做对应处理
    private OnGetIntentEnd(_AIAgentData, LUISData) {
        this.GetBZLDBpediaData(_AIAgentData, LUISData, (LUISRes: ILUISRes) => {
            this.noneIntentHandler(_AIAgentData, LUISRes, (_LUISRes) => {
                this.contextHandler(_AIAgentData, LUISRes, (_LUISRes) => {
                    action.PublishIntent(_AIAgentData, _LUISRes, (_ActionRes: action.IReply) => {
                        this.OnIntentCompleted(_ActionRes, _AIAgentData, _LUISRes);
                    });
                });
            });
        })
    }

    //接到的意图对象后做对应处理同步
    private OnGetIntentEndSync(_AIAgentData, LUISData, callback: (res: string) => void) {
        this.GetBZLDBpediaData(_AIAgentData, LUISData, (LUISRes: ILUISRes) => {
            this.noneIntentHandler(_AIAgentData, LUISRes, (_LUISRes) => {
                this.contextHandler(_AIAgentData, LUISRes, (_LUISRes) =>
                {
                    action.PublishIntent(_AIAgentData, _LUISRes, (_ActionRes: action.IReply, _Ctrldatas: Array<any>) =>
                    {
                        this.OnIntentCompletedSync(_ActionRes, _Ctrldatas, _AIAgentData, _LUISRes, callback);
                    });
                });
            });
        })
    }

    //Intent执行完成后
    public OnIntentCompleted(SpeechResObject: action.IReply, _AIAgentData: IAIAgentData, _LUISRes: ILUISRes) {
        // SpeechResObject.speechID<0 代表错误
        if (SpeechResObject.speechID < 0) {
            return;
        }
        // 机器人请求的实体存入数据库
        console.log("SpeechResObject.IsOver" + SpeechResObject.IsOver);
        if (SpeechResObject.IsOver) {
            let redis = new redisHelper.Redis(enumclass.RedisCollection.UserIntents);
            redis.DeleteItemFromHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, (err, res) => { });
        } else {
            if ("None" != _LUISRes.intent.MainIntent) {
                let intent: INTENT.Iintent = new INTENT.intent(_LUISRes, SpeechResObject.RequestEntities);
                let redis = new redisHelper.Redis(enumclass.RedisCollection.UserIntents);
                redis.SetItemToHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, JSON.stringify(intent), (err, res) => { });
            }
        }
        let mysqlstime = new Date().getTime();
        mysqlstime = mysqlstime - new Date().getTime();
        _AIAgentData.logTime.push({ "mysqlstime": mysqlstime.toString() });
        let testText: string = '{Text}';
        if (SpeechResObject.speechID == 5003) {
            //let index = Math.ceil(Math.random() * noneRes.length - 1)
            //testText = noneRes[index];
            testText = _AIAgentData.query;
        }
        if (null != SpeechResObject.SpeechPas) {
            for (var key in SpeechResObject.SpeechPas) {
                testText = testText.replace(`{${SpeechResObject.SpeechPas[key].name}}`, SpeechResObject.SpeechPas[key].content[0]);
            }
        }
        if (SpeechResObject.speechID == 2003) {
            this.AddSpeechToRedis(testText, 1, { intent: SpeechResObject.intentName, Entity: SpeechResObject.SpeechPas }, _AIAgentData)
        }
        else if (SpeechResObject.speechID == 3003) {
            this.AddSpeechToRedis(testText, 2, { intent: SpeechResObject.intentName, Entity: SpeechResObject.SpeechPas }, _AIAgentData)
        }
        else {
            this.AddSpeechToRedis(testText, 0, { intent: SpeechResObject.intentName, Entity: SpeechResObject.SpeechPas }, _AIAgentData)
        }

    }

    //Intent执行完成后同步
    public OnIntentCompletedSync(SpeechResObject: action.IReply, _Ctrldatas: any, _AIAgentData: IAIAgentData, _LUISRes: ILUISRes, callback: (res: string) => void)
    {
        // SpeechResObject.speechID<0 代表错误
        if (SpeechResObject.speechID < 0) {
            return;
        }
        // 机器人请求的实体存入数据库
        console.log("SpeechResObject.IsOver" + SpeechResObject.IsOver);
        if (SpeechResObject.IsOver) {
            let redis = new redisHelper.Redis(enumclass.RedisCollection.UserIntents);
            redis.DeleteItemFromHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, (err, res) => { });
            //new redisHelper.Redis(enumclass.RedisCollection.UserIntents, (rc) => {
            //    rc.DeleteItemFromHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, (err, res) => {
            //        rc.Quit();
            //    });
            //});
        } else {
            if ("None" != _LUISRes.intent.MainIntent) {
                let intent: INTENT.Iintent = new INTENT.intent(_LUISRes, SpeechResObject.RequestEntities);
                let redis = new redisHelper.Redis(enumclass.RedisCollection.UserIntents);
                redis.SetItemToHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, JSON.stringify(intent), (err, res) => { }, 30);
                //new redisHelper.Redis(enumclass.RedisCollection.UserIntents, (rc) => {
                //    rc.SetItemToHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, JSON.stringify(intent), (err, res) => {
                //        rc.Quit();
                //    }, 30);
                //});
            }
        }
        let mysqlstime = new Date().getTime();
        mysqlstime = mysqlstime - new Date().getTime();
        _AIAgentData.logTime.push({ "mysqlstime": mysqlstime.toString() });
        let testText: string = '{Text}';
        if (SpeechResObject.speechID == 5003) {
            //let index = Math.ceil(Math.random() * noneRes.length - 1)
            //testText = noneRes[index];
            testText = _AIAgentData.query;

        }
        if (null != SpeechResObject.SpeechPas) {
            for (var key in SpeechResObject.SpeechPas) {
                testText = testText.replace(`{${SpeechResObject.SpeechPas[key].name}}`, SpeechResObject.SpeechPas[key].content[0]);
            }
        }
        if (SpeechResObject.speechID == 2003) {
            this.AddSpeechToRedisSync(testText, 1, { intent: SpeechResObject.intentName, Entity: SpeechResObject.SpeechPas }, _AIAgentData, _Ctrldatas, callback)
        }
        else if (SpeechResObject.speechID == 3003) {
            this.AddSpeechToRedisSync(testText, 2, { intent: SpeechResObject.intentName, Entity: SpeechResObject.SpeechPas }, _AIAgentData, _Ctrldatas, callback)
        }
        else {
            this.AddSpeechToRedisSync(testText, 0, { intent: SpeechResObject.intentName, Entity: SpeechResObject.SpeechPas }, _AIAgentData, _Ctrldatas, callback)
        }

    }

    //添加回复到数据库异步
    private AddSpeechToRedis(_text: string, _status: number, IntentMessageObject: Object = null, _AIAgentData: IAIAgentData) {
        _text = Sf.filterWords(_text);
        console.log(_text);
        _AIAgentData.logTime.push({ "total": (new Date().getTime() - parseInt(_AIAgentData.time)).toString() });
        var Item: Object = {
            Module: 10000, instruct:
            { txt: _text, intentMessage: IntentMessageObject, State: _status },
            source: "server",
            'resp-time': _AIAgentData.logTime,
            requestTime: _AIAgentData.time,
            query: _AIAgentData.query,
            id: _AIAgentData.ID,
            isTime: true
        };
        let redis = new redisHelper.Redis(enumclass.RedisCollection.UserSendMessage);
        redis.SetItemToList(_AIAgentData.ID, JSON.stringify(Item), (err, res) => { }, 12000);
        redis.PubMsgToChannel("log", JSON.stringify(Item));
        let redis2 = new redisHelper.Redis(enumclass.RedisCollection.UserGetMessage);
        Item['resp-time'] = null;
        redis2.SetItemToList_Right(_AIAgentData.ID, JSON.stringify(Item), (err, res) => { }, 60);
    }

    //添加回复到数据库同步
    private AddSpeechToRedisSync(_text: string, _status: number, IntentMessageObject: Object = null, _AIAgentData: IAIAgentData, _Ctrldatas: Array<any>, callback: (res: string) => void)
    {
        _text = Sf.filterWords(_text);
        console.log(_text);
        _AIAgentData.logTime.push({ "total": (new Date().getTime() - parseInt(_AIAgentData.time)).toString() });
        var Item: Object = {
            Module: 10000, instruct:
            { txt: _text, intentMessage: IntentMessageObject, State: _status },
            source: "server", 
            'resp-time': _AIAgentData.logTime,
            requestTime: _AIAgentData.time,
            query: _AIAgentData.query,
            id: _AIAgentData.ID,
            isTime: true
        };
        _Ctrldatas.push(Item);
        let redis2 = new redisHelper.Redis(enumclass.RedisCollection.UserSendMessage);
        redis2.SetItemToList(_AIAgentData.ID, JSON.stringify(_Ctrldatas), (err, res) => { }, 12000);
        redis2.PubMsgToChannel("log", JSON.stringify(_Ctrldatas));
        Item['resp-time'] = null;
        callback(JSON.stringify(_Ctrldatas));
    }
    // =========================================================LUIS的处理=========================================================
    //获得我们自己的LUIS结果
    private GetBLZLUISData(_AIAgentData: IAIAgentData, callback: (LUISData: ILUISRes) => void): void {
        var Luisstime = new Date().getTime();
        var req: http.ClientRequest = http.get("<address of Our Own LUIS Engine>" + encodeURI(_AIAgentData.query), (res: http.ClientResponse) => {
            res.setEncoding('utf-8');
            var resdata = "";
            res.on('data', function (data) {
                resdata += data;
            });
            res.on('end', () => {
                Luisstime = Luisstime - new Date().getTime();
                _AIAgentData.logTime.push({ "MyLuisstime": Luisstime.toString(), 'Myluisres': JSON.parse(resdata) });
                callback(this.GetBLZLUISIntent(resdata));
            });
        });
        req.on('error', (e) => {
            console.log("Agent error " + e.message);
        });
    }
    //获得微软的LUIS结果s
    private GetLUISData(_AIAgentData: IAIAgentData, callback: (LUISData: ILUISRes) => void): void {
        var Luisstime = new Date().getTime();
        var req: http.ClientRequest = https.get("<MS LUIS endpoint>" + encodeURI(_AIAgentData.query), (res: http.ClientResponse) => {
            res.setEncoding('utf-8');
            var resdata = "";
            res.on('data', function (data) {
                resdata += data;
            });
            res.on('end', () => {
                Luisstime = Luisstime - new Date().getTime();
                _AIAgentData.logTime.push({ "Luisstime": Luisstime.toString(), 'luisres': JSON.parse(resdata) });
                callback(this.GetLUISIntent(resdata));
            });
        });
        req.on('error', (e) => {
            console.log("Agent error " + e.message);
        });
    }
    //解析我们自己LUIS数据
    private GetBLZLUISIntent(LUISJosn: string): ILUISRes {
        let LUISObject: IBLZLUISRes = JSON.parse(LUISJosn);
        let MainIntent: ILUISRes = new LUISRes();
        MainIntent.intent.MainIntent = LUISObject.intent;
        MainIntent.intent.score = LUISObject.score;
        if (null != LUISObject.entities) {
            for (let index in LUISObject.entities) {
                LUISObject.entities[index].isNew = 0;
                if (MainIntent.entities.hasOwnProperty(LUISObject.entities[index]["type"])) {
                    MainIntent.entities[LUISObject.entities[index]["type"]].push(LUISObject.entities[index]);
                }
                else {
                    MainIntent.entities[LUISObject.entities[index]["type"]] = [LUISObject.entities[index]];
                }

            }
        }
        let numbers = this.GetNumberEntities(LUISObject.text);
        for (let i in numbers) {
            if (MainIntent.entities.hasOwnProperty("builtin.number")) {
                MainIntent.entities["builtin.number"].push({
                    entity: numbers[i],
                    type: "builtin.number",
                    resolution: {
                        number: AIAgent.ParserNumber(numbers[i])
                    },
                });
            }
            else {
                MainIntent.entities["builtin.number"] = [{
                    entity: numbers[i],
                    type: "builtin.number",
                    resolution: {
                        number: AIAgent.ParserNumber(numbers[i])
                    },
                }];
            }
        }

        return this.IntentHanlder(MainIntent);
    }
    //解析微软LUIS数据
    private GetLUISIntent(LUISJosn: string): ILUISRes {
        let LUISObject: IMLUISRes = JSON.parse(LUISJosn);
        let MainIntent: ILUISRes = new LUISRes();
        MainIntent.intent.MainIntent = LUISObject.topScoringIntent.intent;
        MainIntent.intent.score = LUISObject.topScoringIntent.score;
        if (null != LUISObject.entities) {
            for (let index in LUISObject.entities) {
                LUISObject.entities[index].isNew = 0;
                if (MainIntent.entities.hasOwnProperty(LUISObject.entities[index]["type"])) {
                    MainIntent.entities[LUISObject.entities[index]["type"]].push(LUISObject.entities[index]);
                }
                else {
                    MainIntent.entities[LUISObject.entities[index]["type"]] = [LUISObject.entities[index]];
                }
            }
        }
        if (MainIntent.entities.hasOwnProperty("builtin.number")) {
            for (let i in MainIntent.entities["builtin.number"]) {
                MainIntent.entities["builtin.number"][i]["resolution"] = { number: AIAgent.ParserNumber(MainIntent.entities["builtin.number"][i]["entity"]) }
            }
        }
        return this.IntentHanlder(MainIntent);
    }

    //数据特别的处理(讲.改成_)
    private IntentHanlder(LUISRes: ILUISRes):ILUISRes
    {
        for (let entityName in LUISRes.entities)
        {
            if (-1<entityName.indexOf('.'))
            {
                let entityNewName = entityName.replace(/\./g, "_");
                LUISRes.entities[entityNewName] = LUISRes.entities[entityName];
                for (let i = 0; i < LUISRes.entities[entityNewName].length;i++)
                {
                    LUISRes.entities[entityNewName][i].type = entityNewName;
                }
                delete LUISRes.entities[entityName];
            }
        }
        return LUISRes;
    }

    //=========================================================知识库处理=========================================================
    //获得我们自己的知识库的结果
    private GetBZLDBpediaData(_AIAgentData: IAIAgentData, _LUISRes: ILUISRes, callback: (LUISRes: ILUISRes) => void) {
        var Luisstime = new Date().getTime();
        var req: http.ClientRequest = http.get("<address of Our Own LUIS Engine>" + encodeURI(_AIAgentData.query), (res: http.ClientResponse) => {
            res.setEncoding('utf-8');
            var resdata = "";
            res.on('data', function (data) {
                resdata += data;
            });
            res.on('end', () => {
                Luisstime = Luisstime - new Date().getTime();
                _AIAgentData.logTime.push({ "DBtime": Luisstime.toString(), 'DBres': resdata });
                callback(this.GetBZLDBpediaEntities(resdata, _LUISRes));
            });
        });
        req.on('error', (e) => {
            console.log("Agent error " + e.message);
        });
    }
    //解析我们自己知识库数据
    private GetBZLDBpediaEntities(data: string, _LUISRes: ILUISRes): ILUISRes {
        let BZLDBpediaObjects: Object = JSON.parse(data);
        for (let key in BZLDBpediaObjects) {
            if ((BZLDBpediaObjects[key] as Array<string>).length > 0) {
                for (let index in BZLDBpediaObjects[key]) {
                    let entitiy: Ientity = {
                        entity: key,
                        type: BZLDBpediaObjects[key][index],
                        resolution: {},
                        isNew: 0,
                    }
                    if (_LUISRes.entities.hasOwnProperty(entitiy["type"])) {
                        _LUISRes.entities[entitiy["type"]].push(entitiy);
                    }
                    else {
                        _LUISRes.entities[entitiy["type"]] = [entitiy];
                    }
                }
            }
        }
        return _LUISRes;
    }
    //=========================================================上下文处理=========================================================
    //上下文处理
    private contextHandler(_AIAgentData: AIAgentData, _LUISRes: ILUISRes, callback: (LUISRes: ILUISRes) => void) {
        let redis2 = new redisHelper.Redis(enumclass.RedisCollection.UserIntents);
        redis2.GetItemFromHash(_AIAgentData.ID, _LUISRes.intent.MainIntent, (err, res) => {
            if (err) {
                console.error("上下文处理" + res);
                callback(_LUISRes)
            }
            else {
                if (res) {
                    let preIntent = JSON.parse(res) as INTENT.Iintent;
                    if (Date.now() - preIntent.creatTime < 30000) {
                        for (let key in preIntent.LUISRes.entities) {
                            if (!_LUISRes.entities.hasOwnProperty(key)) {
                                _LUISRes.entities[key] = preIntent.LUISRes.entities[key]
                            }
                        }
                    }
                    for (let key in _LUISRes.entities) {
                        for (let i = 0; i < (_LUISRes.entities[key] as Ientity[]).length; i++)
                            (_LUISRes.entities[key] as Ientity)[i].isNew++;
                    }
                    callback(_LUISRes);
                }
                else {
                    callback(_LUISRes);
                }
            }
        });
    }
    //Context意图处理 
    private noneIntentHandler(_AIAgentData: AIAgentData, _LUISRes: ILUISRes, callback: (LUISRes: ILUISRes) => void) {
        if ("Context" == _LUISRes.intent.MainIntent) {
            let redis2 = new redisHelper.Redis(enumclass.RedisCollection.UserIntents);
            redis2.GetAllItemFromHashAndParse(_AIAgentData.ID, (err, res) => {
                if (err) {
                    console.error("Context意图处理 " + res);
                    callback(_LUISRes)
                }
                else {
                    if (res) {
                        let preIntents = res as INTENT.Iintent[];
                        for (let index in preIntents) {
                            preIntents[index] = JSON.parse(res[index]['key'] as string);
                            if (Date.now() - preIntents[index].creatTime < 30000) {
                                for (let key in preIntents[index].RequestEntities) {
                                    if (_LUISRes.entities.hasOwnProperty(preIntents[index].RequestEntities[key].entityName)) {
                                        _LUISRes.intent.MainIntent = preIntents[index].LUISRes.intent.MainIntent
                                        for (let i = 0; i < preIntents[index].RequestEntities.length;i++)
                                        {
                                            if (!_LUISRes.entities[preIntents[index].RequestEntities[i].entityName]&&preIntents[index].RequestEntities[i].entity && preIntents[index].RequestEntities[i].entity.length > 0)
                                            {
                                                _LUISRes.entities[preIntents[index].RequestEntities[i].entityName] = [];
                                                for (let j = 0; j < preIntents[index].RequestEntities[i].entity.length; j++) {
                                                    _LUISRes.entities[preIntents[index].RequestEntities[i].entityName].push(
                                                        {
                                                            entity: preIntents[index].RequestEntities[i].entity[j],
                                                            type: preIntents[index].RequestEntities[i].entityName,
                                                            resolution: {},
                                                            isNew: 0,
                                                        }
                                                    );
                                                }
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        callback(_LUISRes);
                    }
                    else {
                        callback(_LUISRes);
                    }
                }
            });
        }
        else {
            callback(_LUISRes)
        }
    }
    //=========================================================实体特殊处理=========================================================
    private static nubstrs = '1234567890一二三四五六七八九零十百千万';
    //判断有没有数字实体 小数暂时不处理
    public GetNumberEntities(text: string): Array<string> {
        var array: Array<string> = [];
        var str_num: string = '';
        for (var i = 0; i < text.length; i++) {
            if (AIAgent.nubstrs.indexOf(text[i]) > -1) {
                str_num += text[i];
            }
            else if (AIAgent.nubstrs.indexOf(text[i - 1]) > -1) {
                array.push(str_num);
                str_num = '';
            }
        }

        return array;
    }

    private static StrToNub: Object =
    {
        "零": 0,
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
    };

    private static tenToNub: Object =
    {
        "十": 10,
        "百": 100,
        "千": 1000,
        "万": 10000,
    };

    private static ParserInteger(Integer: string): number {
        var totalNub = 0;
        var subNub = 0;
        for (var i = 0; i < Integer.length; i++) {
            if ('' == Integer || null == Integer) {
                return NaN;
            }
            if (AIAgent.StrToNub.hasOwnProperty(Integer[i])) {
                subNub += AIAgent.StrToNub[Integer[i]];
                if (Integer.length - 1 == i) {
                    totalNub += subNub;
                    subNub = 0;
                }
            }
            else if (AIAgent.tenToNub.hasOwnProperty(Integer[i])) {
                if (0 == subNub) {
                    subNub += 1;
                }
                subNub *= AIAgent.tenToNub[Integer[i]];
                totalNub += subNub;
                subNub = 0;
            }
            else {
                return NaN;
            }
        }
        return totalNub;
    }

    private static ParserDecimal(Decimal: string): number {
        if ('' == Decimal || null == Decimal) {
            return NaN;
        }
        var totalstr = '0.'
        for (var i = 0; i < Decimal.length; i++) {
            if (AIAgent.StrToNub.hasOwnProperty(Decimal[i])) {
                totalstr += AIAgent.StrToNub[Decimal[i]];
            }
            else {
                return NaN;
            }

        }
        return parseFloat(totalstr);
    }

    private static ParserNumber(strnubmer: string): number {
        var strRes = parseFloat(strnubmer);
        if (!isNaN(strRes)) {
            return strRes;
        }
        else {
            var strnubmers: string[] = strnubmer.split('点');
            var Integer = AIAgent.ParserInteger(strnubmers[0]);
            if (strnubmers.length > 1) {
                var Decimal = AIAgent.ParserDecimal(strnubmers[1]);
                return Integer + Decimal;
            }
            else {
                return Integer;
            }
        }

    }

    constructor() {

    }
}
export let AIAgent_ = new AIAgent();
//=================================TEST=================================
//console.log("TEST START");
//let AIAgentData_: IAIAgentData = new AIAgentData();
//AIAgentData_.ID = '123124';
//AIAgentData_.LID = '0';
//AIAgentData_.query = "明天上午南京天气怎么样";
//AIAgentData_.time = Date.now().toString();
//AIAgentData_.CID = 0;
//AIAgent_.GetTextTouch(AIAgentData_);