var express=require('express')
var Router=express.Router()
var mongo=require('mongodb').MongoClient;
var bodyP=require('body-parser')
var app=express()
var URL=require('url')
var formidable=require('formidable')
var fs=require('fs')
var path=require('path')
var mongo_url="mongodb+srv://onlyuser:<mern_skill>@cluster0.4vkfd.mongodb.net/players?retryWrites=true&w=majority"

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


Router
.get(['/getPlayers'],function(req,res,next){
    headers.SetResHeaders(req,res);
    mongo.connect(mongo_url,function(err,db){
        if(err){
            res.end(err)
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
            mongo.connect(mongo_url,function(err,db){
                if(err){
                    res.end("Unable to add player in db")
                }
                else{
                    var dbo=db.db("players");
                    var req_obj=playerdata[0]
                    if(req_obj){
                        var query={_id:req_obj._id}
                        dbo.collection("players_document").find(query).toArray(function(err,result){
                            if(err){
                                res.end("Unable to add player in document")
                            }
                            else{
                                if(result.length === 1){
                                    res.end("duplicate")
                                    db.close()
                                }
                                else{
                                    dbo.collection("players_document").insertOne(req_obj,function(err,result){
                                        if(err){
                                            res.end("Unable to add player in document")
                                        }
                                        else{
                                            if(result.insertedCount === 1){
                                                res.end("success")
                                                db.close()
                                                var new_path='../serverpracticereact/playerimages'
                                                if(!fs.existsSync(new_path)){
                                                    fs.mkdir('../serverpracticereact/playerimages')
                                                }
                                                var old_path=files.playerimage.path
                                                fs.readFile(old_path,function(err,data){
                                                    fs.writeFile(new_path+'/'+playerdata[0]._id+".png",data,function(err){
                                                        //
                                                    })
                                                })
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
        else{
            res.end("Error while adding player")
        }
    })
})
.post('/AddToLog',function(req,res,next){
    headers.SetResHeaders(req,res);
    //var url="mongodb://localhost/"
    mongo.connect(mongo_url,function(err,db){
        if(err){
            res.end("Error while connecting db")
        }
        else{
            var dbo=db.db("players")
            var req_obj=req.body
            dbo.collection("PlayersChangeLog").insertOne(req_obj,function(err,result){
                if(err || result.insertedCount !== 1){
                    res.end("error while updating changelog")
                }
                else{
                    res.end("Change Log Updated")
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
            res.end("Error while connecting to db")
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
.get(['/searchPlayer'],function(req,res,next){
    headers.SetResHeaders(req,res);
    const query=req.body.playerName
})
.get('/getPlayer', function(req,res,next){
    headers.SetResHeaders(req,res);
    mongo.connect(mongo_url,function(err,db){
        if(err){
            res.end("Unable to retirieve player data")
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