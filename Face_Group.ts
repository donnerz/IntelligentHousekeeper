import httpMgr = require("../httpMgr");
import http = require("http");
import personUnit = require("./Face_Person");

interface IGroupsProxy
{
    createGroup(_group: IGroupData): Promise<IGroupResponse>;
    delGroup(_groupID: string): Promise<IGroupResponse>;
    getGroup(_groupID: string): Promise<IGroupResponse>;
    setGroup(_group: IGroupData): Promise<IGroupResponse>;
    trianGroup(_groupID: string): Promise<IGroupResponse>;
}

export interface IGroupData
{
     personGroupId: string
     name: string
     userData: string
}

export interface IGroupAction
{
    createPerson(_person: personUnit.Person): Promise<personUnit.IPersonResponse>

    deletePerson(_person: personUnit.Person): Promise<personUnit.IPersonResponse>

    addPersonFace(_person: personUnit.IPersonData, url: string): Promise<personUnit.IPersonResponse>

    delPersonFace(_person: personUnit.IPersonData, faceID: string): Promise<personUnit.IPersonResponse>

    getPersons(): Promise<personUnit.IPersonsResponse>

    getPerson(_person: personUnit.IPersonData): Promise<personUnit.IPersonResponse> 
}

export interface IGroup extends IGroupData, IGroupAction
{

}

export class GroupData implements IGroupData
{
    personGroupId: string = null
    name: string = null
    userData: string = null

    constructor(_personGroupId: string = null, _name: string = null, _userData: string = null)
    {
        this.personGroupId = _personGroupId;
        this.name = _name;
        this.userData = _userData;
    }
}

export class Group implements IGroupAction{

    private groupData_: IGroupData = null

    private personProxy_: personUnit.PersonProxy = null;

    public async createPerson(_person: personUnit.IPersonData): Promise<personUnit.IPersonResponse>
    {
        if (this.personProxy_) {
            return this.personProxy_.createPerson(this.groupData_.personGroupId, _person);
        }
        else {
            return { err: 'personProxy is null', person: null };
        }
    }

    public async addPersonFace(_person: personUnit.IPersonData, url: string): Promise<personUnit.IPersonResponse> {
        if (this.personProxy_) {
            return this.personProxy_.addPersonFace(this.groupData_.personGroupId, _person, url);
        }
        else {
            return { err: 'personProxy is null', person: null };
        }
    }

    public async delPersonFace(_person: personUnit.IPersonData, faceID: string): Promise<personUnit.IPersonResponse>
    {
        if (this.personProxy_) {
            return this.personProxy_.delPersonFace(this.groupData_.personGroupId, _person, faceID);
        }
        else {
            return { err: 'personProxy is null', person: null };
        }
    }

    public async deletePerson(_person: personUnit.IPersonData): Promise<personUnit.IPersonResponse> {
        if (this.personProxy_) {
            return this.personProxy_.deletePerson(this.groupData_.personGroupId, _person);
        }
        else {
            return { err: 'personProxy is null', person: null };
        }
    }

    public async getPersons(): Promise<personUnit.IPersonsResponse>
    {
        if (this.personProxy_) {
            return this.personProxy_.getPersons(this.groupData_.personGroupId);
        }
        else {
            return { err: 'personProxy is null', persons: null };
        }
    }

    public async getPerson(_person: personUnit.IPersonData): Promise<personUnit.IPersonResponse> {
        if (this.personProxy_) {
            return this.personProxy_.getPerson(this.groupData_.personGroupId, _person.personId);
        }
        else {
            return { err: 'personProxy is null', person: null };
        }
    }

    constructor(_personGroupId: string, _name: string, _userData: string, _personProxy: personUnit.PersonProxy) {
        this.groupData_ = new GroupData(_personGroupId, _name, _userData);
        this.personProxy_ = _personProxy;
    }
}

export interface IGroupResponse
{
    err: string;
    group: IGroupData;
}

class GroupsProxy implements IGroupsProxy
{
    private MicHeader =
    {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": "<Your Key>",
    }

    private MicHost = "api.cognitive.azure.cn"

    async createGroup(_group: IGroupData): Promise<IGroupResponse>{
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_group.personGroupId}`,
            httpMgr.httpMethod.PUT,
            JSON.stringify({ name: _group.name, userData: _group.userData }),
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            return { err: null, group: new GroupData(_group.personGroupId, _group.name, _group.userData) };
        }
        else {
            return { err: res.res, group: null };
        }
    }

    async delGroup(_groupID: string): Promise<IGroupResponse>
    {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}`,
            httpMgr.httpMethod.DELETE,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            return { err: null, group: null };
        }
        else {
            return { err: res.res, group: null };
        }
    }

    async getGroup(_groupID: string): Promise<IGroupResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}`,
            httpMgr.httpMethod.GET,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            let group = JSON.parse(res.res);
            return { err: null, group: group };
        }
        else {
            return { err: res.res, group: null };
        }
    }

    async setGroup(_group: IGroupData): Promise<IGroupResponse> {
        return { err: null, group: null };
    }

    async trianGroup(_groupID: string): Promise<IGroupResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/persongroups/${_groupID}/train`,
            httpMgr.httpMethod.POST,
            null,
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        console.log("trianGroup" + JSON.stringify(res));
        if (2 == Math.floor(res.sCode / 100)) {
            return { err: null, group: null };
        }
        else {
            return { err: res.res, group: null };
        }
    }
}

class GroupMgr
{
    private gp: IGroupsProxy = null;

    async createGroup(_group: IGroupData): Promise<IGroupResponse>
    {
        return gp.createGroup(_group);
    }

    async getGroup(_groupID: string): Promise<IGroupResponse>
    {
        return gp.getGroup(_groupID);
    }

    async setGroup(_group: IGroupData): Promise<IGroupResponse> {
        return gp.setGroup(_group);
    }

    async delGroup(_groupID: string): Promise<IGroupResponse> {
        return gp.delGroup(_groupID);
    }

    async trianGroup(_groupID: string): Promise<IGroupResponse> {
        return gp.trianGroup(_groupID);
    }

    constructor(_groupsProxy:IGroupsProxy)
    {
        this.gp = _groupsProxy;
    }
}

let gp: IGroupsProxy = new GroupsProxy();
export let groupMgrIntance = new GroupMgr(gp);



