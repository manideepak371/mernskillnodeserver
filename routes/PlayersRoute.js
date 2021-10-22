var express=require('express')
var Router=express.Router()
var mongo=require('mongodb').MongoClient;
var bodyP=require('body-parser')
var app=express()
var URL=require('url')
var formidable=require('formidable')
var fs=require('fs')
var path=require('path')
var mongo_url="mongodb+srv://onlyuser:root@cluster0.4vkfd.mongodb.net/players?retryWrites=true&w=majority"


let dup_flag=false
let success_flag=false
let bulkuploadresponse=null

var headers={
    SetResHeaders: function(req,res){
        res.setHeader('Access-Control-Allow-Origin','*');
        res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE');
        res.setHeader('Access-Control-Allow-Credentials','true');
        res.setHeader('Access-Control-Allow-Headers','X-Requested-With,Content-Type');
    }
}

async function findone(dbo,id,req){
    var ObjectId=require("mongodb").ObjectId
    var doc=await dbo.collection("players_document").findOne({_id:id}).then(value =>{
        return value
    })
    doc._id=req.body.new_id
    dbo.collection("players_document").insertOne(doc)
    dbo.collection("players_document").deleteOne({_id:req.body._id})   
}

function addplayer(mongo_url,database,collection,data,callback){
    mongo.connect(mongo_url,function(err,db){
        if(err){
            callback("Unable to connect to mongo")         
        }
        else{
            var dbo=db.db(database);
            var req_obj=data
            if(req_obj){
                var query={_id:req_obj._id}
                dbo.collection(collection).find(query).toArray(function(err,result){
                    if(err){
                        callback("error in finding the duplicate player")
                    }
                    else{
                        if(result.length === 1){
                            db.close()
                            callback("duplicate")
                        }
                        else{
                            dbo.collection(collection).insertOne(req_obj,function(err,result){
                                if(err){
                                    callback("Unable to add new player to the collection")
                                }
                                else{
                                    if(result.insertedCount === 1){
                                        db.close()
                                        callback("success")
                                    }
                                }
                            })
                        }
                    }
                })
            }       
        }
    })
}

Router
.get(['/getPlayers'],function(req,res,next){
    headers.SetResHeaders(req,res);
    mongo.connect(mongo_url,function(err,db){
        if(err){
            console.log(err)
            res.end("Error connecting to db")
        }
        else{
            var dbo=db.db("players");
            dbo.collection("players_document").find({},{projection:{_id:0}}).toArray(function(err,result){
                if(err){
                    res.end("Mongo document error")
                }
                else{
                    res.end(JSON.stringify(result))
                    db.close();
                }
            })
        }
    })
})
.post(['/addPlayer',],function(req,res,next){
    headers.SetResHeaders(req,res);
    //var url="mongodb://localhost"
    var form=new formidable.IncomingForm()
    form.parse(req,function(err,fields,files){
        var playerdata=[]
        playerdata.push(JSON.parse(fields.playerdata))
        if(playerdata.length >0 ){
            const addplayerReturn=addplayer(mongo_url,"players","players_document",playerdata[0])
            console.log(addplayerReturn)
            if(addplayerReturn === "duplicate"){
                res.end("duplicate")
                return
            }
            if(addplayerReturn === "success")
            {
                res.end("success")
                return
            }
        }
        else{
            res.end("No player data to read from")
        }
    })
})
.post('/AddToLog',function(req,res,next){   
    headers.SetResHeaders(req,res);
    //var url="mongodb://localhost/"
    mongo.connect(mongo_url,function(err,db){
        if(err){
            console.log(err)
            res.end("Error connecting to db")
        }
        else{
            var dbo=db.db("players")
            var req_obj=req.body
            console.log(req.body)
            var Log=req.body
            dbo.collection("PlayersChangeLog").insertOne(Log,function(err,result){
                if(err){
                    console.log(err)
                    res.end("error while updating changelog")
                    return
                }
                else{
                    if(result.insertedCount !== 1){
                        res.end("Unable to update Change Log")
                        return
                    }
                    else{
                        res.end("Change Log Updated")
                        return
                    }
                }
            })
            db.close()
        }
    })
})
.get('/GetLog',function(req,res,next){
    headers.SetResHeaders(req,res)
    //var mongo_url="mongodb://localhost/"
    mongo.connect(mongo_url,function(err,db){
        if(err){
            console.log(err)
            res.end("Error connecting to db")
        }
        else{
            var dbo=db.db("players")
            dbo.collection("PlayersChangeLog").find().toArray(function(err,result){
                if(err){
                    res.end("Error while retrieving data")
                }
                else{
                    res.end(JSON.stringify(result))
                    db.close()
                }
            })
        }
    })
})
.post(['/updatePlayer'],function(req,res,next){
    headers.SetResHeaders(req,res)
    mongo.connect(mongo_url,function(err,db){
        if(err){
            console.log(err)
            res.end("Unable to Update Player")
        }
        else{
            const dbo=db.db("players")
            const req_obj=req.body
            var query=JSON.stringify(req.body._id)
            if(req.body._id !== req.body.new_id){
                findone(dbo,req.body._id,req)
            }
            setTimeout(()=>{
                const obj=req_obj.data.length >0 ? req_obj.data : null
                var modifiedcount=0
                var matchedcount=0
                query=req.body.new_id
                if(obj !== null){
                    obj.map(a =>{
                        dbo.collection("players_document").updateOne({_id:query},{$set:{[Object.keys(a)[0]]:a[Object.keys(a)[0]]}})
                        .then(result =>{
                            if(result.modifiedCount === 1)
                                modifiedcount=modifiedcount+1
                            else{
                                if(result.matchedCount === 1)
                                    matchedcount=matchedcount+1 
                            }    
                        })
                    })
                }
                setTimeout(()=>{
                    if(modifiedcount === obj.length || matchedcount === obj.length){
                        res.end("updated")
                    }
                    else{
                        res.end("not updated")
                    }
                },100)
                db.close()
            },300)
        }
    })
})
.post(['/uploadBulk'],function(req,res,next){
    headers.SetResHeaders(req,res);
    var form=new formidable.IncomingForm()
    form.parse(req,function(err,fields,files){
        if(err){
            var x={uploaded:false}
            console.log(err)
            res.end(JSON.stringify(x))
            return
        }
        const data=JSON.parse(fields.filedata)
        console.log(fields)
        if(data.length>0){
            data.map(doc =>{    
                addplayer(mongo_url,"players","players_document",doc,function(response){
                    console.log(response)
                    if(response === "duplicate"){
                        dup_flag=true
                    }
                    if(response === "success")
                    {
                        success_flag=true
                    }
                    
                })
            })
            setTimeout(()=>{
                if(dup_flag && !success_flag){
                    console.log("All duplicates")
                    res.end("duplicate")
                    dup_flag=false
                    success_flag=false
                    return
                }
                if(!dup_flag && success_flag){
                    console.log("success")
                    res.end("success")
                    dup_flag=false
                    success_flag=false
                    return
                }
                if(dup_flag && success_flag){
                    console.log("Partial duplicates")
                    res.end("partial")
                    dup_flag=false
                    success_flag=false
                    return
                }       
            },200) 
        }
        else{
            res.end("No data to read from")
            return
        }
    })    
})
.get('/getPlayer', function(req,res,next){
    headers.SetResHeaders(req,res);
    mongo.connect(mongo_url,function(err,db){
        if(err){
            console.log(err)
            res.end("Unable to retirieve player data from db")
        }
        else{
            const dbo=db.db("players")
            var query={_id:req.query.id}
            dbo.collection("players_document").find(query,{projection:{_id:0}}).toArray(function(err,result){
                if(err){
                    res.end("Unable to retrieve player data from database")
                }
                else{
                    if(result.length === 1){
                        res.end(JSON.stringify(result))
                    }
                }
            })
            db.close()
        }
    })
})


module.exports=Router


//insert data into db
           /*
           
           var req_obj=req.body
           dbo.collection("docu_collection").insertOne(req_obj,function(err,result){
               if(err){
                   res.end("Unable to insert data")
               }
               else{
                   res.end("Inserted")
               }
           })
           db.close()
           */