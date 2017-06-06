import httpMgr = require("../httpMgr");
import http = require("http");

export interface IfaceRectangle {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface IFace {
    faceId: string;
    faceRectangle: IfaceRectangle;
}

export interface IFacesResponse {
    err: string;
    faces: IFace[];
}

export interface ICandidate
{
    personId: string;
    confidence: number;
}

export interface IIdentifyFace
{
    faceId: string
    candidates: ICandidate[];
}


export interface IIdentifyFaces
{
    err: string
    identifyFaces: IIdentifyFace[];
}

class face implements IFace
{
    private faceId_: string = null
    private faceRectangle_: IfaceRectangle = null

    public get faceId()
    {
        return this.faceId_;
    } 

    public get faceRectangle() {
        return this.faceRectangle_;
    } 
}


class faceProxy
{
    private MicHeader =
    {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": "<Your Key>",
    }

    private MicHost = "api.cognitive.azure.cn"

    public async detectFace(url: string): Promise<IFacesResponse> {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/detect?returnFaceId=true&returnFaceLandmarks=false`,
            httpMgr.httpMethod.POST,
            JSON.stringify({ "url": url}),
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("detectFace" + res.res);
            return { err: null, faces: JSON.parse(res.res) };
        }
        else {
            return { err: res.res, faces: null };
        }
    }


    public async identifyFace(groupID: string, faceids: string[]): Promise<IIdentifyFaces>
    {
        let option: httpMgr.IhttpOption = new httpMgr.httpOption(
            this.MicHost,
            443,
            `/face/v1.0/identify`,
            httpMgr.httpMethod.POST,
            JSON.stringify({
                "personGroupId": groupID,
                "faceIds": faceids,
                "maxNumOfCandidatesReturned": 1,
                "confidenceThreshold": 0.6
            }),
            this.MicHeader,
        );
        let res: httpMgr.IhttpResponse = await httpMgr.httpsRequst(option);
        if (2 == Math.floor(res.sCode / 100)) {
            console.log("identifyFace" + res.res);
            return { err: null, identifyFaces: JSON.parse(res.res) };
        }
        else {
            return { err: res.res, identifyFaces: null };
        }
    }
}

class FaceMgr
{
    private faceProxy_: faceProxy = null

    public async detectFace(url: string): Promise<IFacesResponse>
    {
        return this.faceProxy_.detectFace(url);
    }

    public async identifyFace(groupID: string, faceids: string[]): Promise<IIdentifyFaces> {
        return this.faceProxy_.identifyFace(groupID, faceids);
    }



    constructor(_faceProxy = new faceProxy())
    {
        this.faceProxy_ = _faceProxy;
    }

}

export let FaceMgrIntance = new FaceMgr();