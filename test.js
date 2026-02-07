const express= require("express");
const app=express();

app.use(express.json());
let users=[
    {id:1, name:"rajesh",age:24},
    {
        id:2, name:"rajesh",age:25
    }
]

app.get("/users/list/:id",(req,res)=>{
    const  userid=parseInt(req.params.id);
   const nusers=users.find(u=>u.id === userid );

  if (!nusers) {
    return res.status(404).json({ message: "User not found" });
  }

        res.json(nusers);
    });

app.post("/users/add",(req,res)=>
{
    const r=req.body;
   users.push(r); 
   res.send("add");
});
app.put("/user/:id",(req,res)=>{
   const  userid=parseInt(req.params.id);
   users=users.map(u=>u.id==userid ?{...u,name:req.body.name}:u);
   res.send("update");
});
app.delete("/user/:id",(req,res)=>{
    const  userid=parseInt(req.params.id);
    users=users.filter(u=>u.id==userid);
    res.send("deleted");
})

app.listen(3000,()=>{
    console.log("server running ");

});