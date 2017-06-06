import httpMgr = require("../httpMgr");
import http = require("http");

export interface IPersonData {
    personId: string;
    name: string;
    userData: string;
    persistedFaceIds: string[]
}


export interface IPersonAction {

}

export interface IPerson extends IPersonAction, IPersonData
{

}

export interface IPersonResponse
{
    err: string;
    person: IPersonData;
}

export interface IPersonsResponse {
    err: string;
    persons: IPersonData[];
}


export interface IPersonProxy {
    createPerson():Promise<IPersonResponse>;
}

export class Person implements IPerson
{
     personId: string
     name: string
     userData: string
     persistedFaceIds: string[]

    constructor(_personId: string, _name: string, _userData: string, ) {
        this.personId = _personId;
        this.name = _name;
        this.userData = _userData;
        this.persistedFaceIds = [];
    }
}

export class PersonProxy
{

    private MicHeader =
    {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": "<Your Key>",
    }

    private MicHost = "api.cognitive.azure.cn"

    public async createPerson(_groupID: string, _person: IPersonData): Promise<IPersonResponse>
    {
        console.log("createPerson" + JSON.stringify(_person));
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/persons`,
            httpMgr.httpMethod.POST,
            JSON.stringify({ name: _person.name, userData: _person.userData }),
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = null;
        try {
            console.log("-2");
            res = await httpMgr.httpsRequst(option);
        }
        catch (e) {
            return { err: e, person: null };
        }
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("createPerson" + res.res);
            try {
                let person: IPersonData = JSON.parse(res.res);
                return { err: null, person: new Person(person.personId, _person.name, _person.userData) };
            }
            catch(e){
                return { err: res.res, person: null };
            }
        }
        else {
            return { err: res.res, person: null };
        }
    }

    public async  deletePerson(_groupID: string, _person: IPersonData): Promise<IPersonResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/persons/${_person.personId}`,
            httpMgr.httpMethod.DELETE,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("deletePerson" + res.res);
            return { err: null, person: null };
        }
        else {
            return { err: res.res, person: null };
        }
    }

    public async  getPersons(_groupID: string): Promise<IPersonsResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/persons`,
            httpMgr.httpMethod.GET,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("getPersons" + res.res);
            let persons: IPersonData[] = JSON.parse(res.res);
            return { err: null, persons: persons };
        }
        else {
            return { err: res.res, persons: null };
        }
    }

    public async  getPerson(_groupID: string, _personID: string): Promise<IPersonResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/persons/${_personID}`,
            httpMgr.httpMethod.GET,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("getPersons" + res.res);
            return { err: null, person: JSON.parse(res.res) };
        }
        else {
            return { err: res.res, person: null };
        }
    }



    public async  addPersonFace(_groupID: string, _person: IPersonData, url: string): Promise<IPersonResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/persons/${_person.personId}/persistedFaces`,
            httpMgr.httpMethod.POST,
            JSON.stringify({ "url": url}),
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("addPersonFace" + res.res);
            let face:any = JSON.parse(res.res)
            _person.persistedFaceIds.push(face.persistedFaceId)
            return { err: null, person: _person };
        }
        else {
            return { err: res.res, person: null };
        }
    }


    public async  delPersonFace(_groupID: string, _person: IPersonData, _facdID: string): Promise<IPersonResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/persons/${_person.personId}/persistedFaces/${_facdID}`,
            httpMgr.httpMethod.DELETE,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("delPersonFace" + res.res);
            return { err: null, person: null };
        }
        else {
            return { err: res.res, person: null };
        }
    }


}
