'use strict';

// load package
const express = require('express');
const app = express();
const session = require('express-session');
const bcrypt = require("bcryptjs");
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const bodyParser = require("body-parser");
const MongoDBSession = require('connect-mongodb-session')(session);


var options = {
    key : fs.readFileSync(path.join(__dirname, "perms", "client-key.pem")),
    cert : fs.readFileSync(path.join(__dirname, "perms", "client-cert.pem"))
}


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const cors = require('cors');
const { resolve } = require('path');
const corsOptions = {
    origin: 'http://localhost:3000',  //Your Client, do not write '*'
    credentials: true,
};
app.use(cors(corsOptions));

const userCollection = 'users';
const bookstoreCollection = 'bookstoreUsers';
const listingsCollection = 'listings';
const adminCollection = 'admins';

const PORT = 8000;
const HOST = '0.0.0.0';


// Helper
const panic = (err) => console.error(err)

//Database stuff
const MongoClient = require('mongodb').MongoClient;
const DB_Url = 'mongodb://admin:admin@mongodb:27017/';
var con;

// Connect to database
MongoClient.connect(DB_Url, (err, db) =>{
    //This will connec thte node server to the mongo server on startup
    if (err) throw err;
    //We can change the name later
    con = db.db("ecomDB");

    const adminQuery = {
        username : "admin"
    }
    //Add an admin account
    new Promise((resolve, reject) => {
        con.collection(adminCollection).countDocuments(adminQuery, (err, result)=> {
            if (err) {reject(err)} else {resolve(result)}
        })
    })
    .then((result) => {
        if (result > 0) {
            console.log("MongoDB Connected");
            return
        }
        else {
            const password = "admin"
            bcrypt.hash(password, 12)
            .then((hashedPass) => {
                const newAdmin = {
                    username : "admin",
                    password : hashedPass
                }
                con.collection(adminCollection).insertOne(newAdmin, (err, result) => {
                    if (err) {throw err} else {console.log("MongoDB Connected");}
                })
            })
        }
    })
    .catch((error) => {
        console.log("error initializing DB");
        return;
    })
});
const store = new MongoDBSession({
    uri : DB_Url,
    collection : 'mySessions'
});

app.use(session({
    secret : 'key that will sign cookie',
    resave : false,
    saveUninitialized : true,
    store : store,
    cookie : {
        httpOnly : true,
        maxage : 360000
    }
}));

//Login and Registration stuff
app.post('/login', (req, res)=>{
    //Get the password and username
    const {username, password, accountType} = req.body;
    //Set a default value of users for collection
    //Then Switch it if accountType is not user
    let collection = userCollection;
    let query = {username : username};
    if (accountType == "Bookstore"){
        collection = bookstoreCollection;
        query = {companyName : username};
    } else if (accountType == "Admin"){
        collection = adminCollection;
    }
    //Now check if we were not given basic send an error 
    else if (accountType != "User"){
        res.status(400).send(accountType + " is not a valid account type");
        return;
    }

    new Promise((resolve, reject) => {
        //Query the database with the provided values
        con.collection(collection).find(query).toArray((err, result) => {
            if (err) { reject(err) } else {resolve(result)}
        });
    })
    .then((result) => {
        //Now we check if the encrypted passwords match
        const user = result[0];
        bcrypt.compare(password, user.password)
        .then((result) => {
            if (result) {
                //Add some user info to the cookie to make stuff easy in future
                const userInfo = {
                    isBasic : false,
                    isBookstore : false,
                    isAdmin : false,
                    username : user.username,
                    _id : user._id
                }
                
                if (accountType == "User") {
                    userInfo.isBasic = true;
                } else if (accountType == "Bookstore"){
                    userInfo.isBookstore = true;
                } else if (accountType == "Admin"){
                    userInfo.isAdmin = true;
                }
                
                req.session.user = userInfo;
                res.send("Success");
            } else {
                res.status(400).send("Password does not match");
            }
        })
        .catch((error) => {
            res.status(400).send(error);
        });
    })
    .catch((error) => {
        console.log(error);
        res.status(400).send(error);
    });
});


app.post("/register", (req, res)=> {
    //TODO make register handle both basic and bookstore accounts
    const {username, password, email, address1, address2, fName, lName, city, province, zipcode} = req.body;

    new Promise((resolve, reject) => {
        con.collection(userCollection).countDocuments(
            {$or : [{username : username}, {email : email}]}, (err, result) => {
            if (err) {reject(err)} else {resolve(result)}
        });
    })
    .then((result) => {
        if (result > 0) {
            throw "Username or email already in use"
        }
        bcrypt.hash(password, 12)
        .then((hashedPass) => {
            const newUser = {
                username : username,
                email : email,
                password : hashedPass,
                address1 : address1,
                address2 : address2,
                fName : fName,
                lName : lName,
                city : city,
                province : province,
                zipcode: zipcode,
                listings : [],
                wishlist : []
                };
            con.collection(userCollection).insertOne(newUser, (err, result) =>{
                if (err) { throw err } else {res.send("Success")}
            });
        })
        .catch((error) => {
            console.log(error);
            res.status(400).send(error);
        });
    })
    .catch((error) => {
        console.log(error);
        res.status(400).send(error);
    });
});

app.post("/registerBookstore", (req, res) => {
    //Get the information
    const {companyName, password, email, address1, address2, city, province, zipcode} = req.body;

    new Promise((resolve, reject) => {
        con.collection(bookstoreCollection).countDocuments(
            {$or : [{companyName : companyName}, {email : email}]}, (err, result) => {
                if (err) {reject(err)} else {resolve(result)}
        });
    })
    .then((result) => {
        if (result > 0) {
            throw "Company name or email is already in use";
        }
        bcrypt.hash(password, 12)
        .then((hashedPass) => {
            const newUser = {
                companyName : companyName,
                email : email,
                password : hashedPass,
                address1 : address1,
                address2 : address2,
                city : city,
                province : province,
                zipcode : zipcode,
                listings : [],
                };
            con.collection(bookstoreCollection).insertOne(newUser, (err, result) => {
                if (err) { throw err } else {
                    console.log("success");
                    res.send("Success")
                }
            });
        })
        .catch((error) => {
            console.log(error);
            res.status(400).send(error);
        });
    })
    .catch((error) => {
        console.log(error);
        res.status(400).send(error);
    })
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) throw err;
        console.log("logged out");
        //We can use this to redirect to landing page later
        res.send("logged out")
    });
});

app.get('/users', (req, res) => {
    new Promise((resolve, reject) => {
        con.collection(userCollection).find({}).toArray((err, result) =>{
            if (err) {reject(err)} else {resolve(result)}
        }
    )})
    .then((result) => {
        res.send(result);
    })
    .catch((error) => {
        res.status(400).send(error);
    })
});

app.get('/user', (req, res) => {
    //TODO make handle different account types
    if (req.session.user == undefined) {
        res.status(400).send("Not logged in");
    } else {
        new Promise((resolve, reject) => {
            const query = {_id : req.session.user._id};
            con.collection(userCollection).findOne(query, (err, result) => {
                if (err) {reject(err)} else {resolve(result)}
            });
        })
        .then((result) => {
            delete result.password;
            res.send(result);
        })
        .catch((error) => {
            res.status(400).send("User not found");
        })
    }
});

app.get('/bookstoreUsers', (_, res) => {
    new Promise((resolve, reject) => {
        con.collection(bookstoreCollection).find({}).toArray((err, result) =>{
            if (err) {reject(err)} else {resolve(result)}
        }
    )})
    .then((result) => {
        res.send(result);
    })
    .catch((error) => {
        res.status(400).send(error);
    })
});
//This will return user information from the given cookie
//Will return nothing if there is no cookie with user info
app.get('/isUser', (req, res) => {
    if(req.session.user == undefined){
        res.status(400).send("Not logged in")
    }
    else if(req.session.user.isBasic) {
        res.send("Success");
    } else {
        res.status(400).send("Not logged in")
    }
});


app.post('/regularSearch', (req, res) =>{

    let keyword = req.body.keyword;


        // query the database for all the listings that match just the keyword


        const pipeline = [
            { $match: { title: { $regex: keyword, $options: "i" } } },
            { $group: { _id: "$_id", title: { $push: "$title" } } }
        ];


        async function performSearch(){
            try{
                const listings = await con.collection("listings");
                const aggCursor = await listings.aggregate(pipeline);
                return aggCursor.toArray();
            }
            catch(error){
                console.error(error);
            }
        };

        (async function() {
            let searchResults = await performSearch();
            console.log(searchResults[0]);
            res.send(searchResults);
        })();

});


app.post('/advancedSearch', (req, res) =>{

    let keyword = req.body.keyword;
    //let subject = req.body.subject;
    // let value = req.body.value;
    let author = req.body.author;
    let price = req.body.price;
    let city = req.body.location;

    const pipeline = [
        { $match: { title: { $regex: keyword, $options: "i" }, price: { $lte: price }, 
        authorName: { $regex: author, $options: "i" }, city: { $regex: city, $options: "i" } } },
        { $group: { _id: "$_id", title: { $push: "$title" } }  }
    ];


    async function performSearch(){
        try{
            const listings = await con.collection("listings");
            const aggCursor = await listings.aggregate(pipeline);
            return aggCursor.toArray();
        }
        catch(error){
            console.error(error);
        }
    };

    (async function() {
        let searchResults = await performSearch();
        console.log(searchResults[0]);
        res.send(searchResults);
    })();
});

//All the implementation are from typing TODO change to button

//no picture implementation yet.TODO add a way to add pictures to the mongodb db
app.post('/make-lis' ,(req,res)=>{
    const {title, authorName, description, price, address1, address2, city, province, zipCode} = req.body;
	const datetime = new Date();
    //TODO check if location information is given, if not user session info
    const newListing = {
        title: title,
        authorName : authorName,
        description: description,
        price : price,
        address1 : address1,
        address2 : address2,
        city : city,
        province : province,
        zipCode : zipCode,
        timestamp: datetime,
        posterID : req.session.user._id,
        posterUsername : req.session.user.username,
    }
    new Promise((resolve, reject) => {
        //Add new listing to the database
        con.collection(listingsCollection).insertOne(newListing, (err, result) => {
            if(err) {reject(err)}  else { resolve(result)}
        });
    })
    .then((result) => {
        //TODO add account type detection
        const addListing = {$push: {listings : result.insertedId}};
        con.collection(userCollection).updateOne({username : req.session.user.username}, addListing);
    })
    .then((_) => {
        res.send("Success");
    })
    .catch((error) => {
        console.log(error);
        res.status(400).send(error);
    });
});

//See the listings on the browser 
app.get('/listings', (req,res) => {
	//console.log("here")
    new Promise((resolve, reject) => {
        con.collection("listings").find({}).toArray((err,result) => {
            if(err) {reject(err)} else{resolve(result)}
        }
    )}).then((result) => {
		//console.log("got here"+result.json)
        res.send(result);
    }).catch((error)=>{
        console.log("error!!!!!!!!!!!!!!!!!!!")
        res.status(400).send(error);
    })
});

//This will return all of a users listings
//Requires user to be logged in to return value
app.get('/user/listings', (req, res) => {
    const query = {username : req.session.user.username};

    new Promise((resolve, reject) => {
        con.collection.findOne(query, (err, result) => {
            if (err) { reject(err) } else { resolve(result) }
        });
    })
    .then((result) => {
        const listingIDs = {ids : []}
        result.listings.forEach(element => {
            listingIDs.ids.push(element);
        });
        const listingQuery = {_id : {$in : listingIDs.ids}};
        console.log(listingQuery);
        con.collection(listingsCollection).find(listingQuery).toArray((err, result2) => {
            if (err) {
                res.status(400).send(err);
            } else {
                res.send(result2);
            }
        });
    })
    .catch((error) =>{
        res.status(400).send(error);
    })
});

//Returns the listing for a given ID
app.get('/listing/:listingID', (req, res) => {
     const ObjectId = require('mongodb').ObjectId;
     const listingOID = new ObjectId(req.params.listingID);

     new Promise((resolve, reject) => {
         con.collection(listingsCollection).findOne({_id : listingOID}, (err, result) => {
             if (err) {reject(err)} else {resolve(result)}
         });
     })
     .then((result) => {
         res.send(result);
     })
     .catch((error) =>{
        res.status(400).send(error);
    })
});

//Used to get a number of listings from a given "page" based on the number per page
app.get('/listings/:numberOfListings/:pageNumber', (req, res) => {
    const numberOfListings = parseInt(req.params.numberOfListings);
    const pageNumber = parseInt(req.params.pageNumber);

    let skip = (pageNumber - 1) * numberOfListings;

    if (numberOfListings == NaN || pageNumber == NaN || pageNumber < 1){
        res.status(400).send("error with parameters");
        return;
    }

    new Promise((resolve, reject) => {
        con.collection(listingsCollection).find({}).limit(numberOfListings).skip(skip).toArray((err, result) => {
            if (err) { reject(err) } else {resolve(result)}
        });
    })
    .then((result) => {
        res.send(result);
    })
    .catch((error) => {
        res.status(400).send(error);
    });
});



//John change this to button delete instead of deleting by name
//TODO figure out a delete by button once we actually implement it
app.post('/remove-lis',(req,res)=>{
	var name = req.body.name;
	function removelis(varname){
	MongoClient.connect(DB_Url,function(err,db){
	  if (err) throw err;
		var dbo = db.db("ecomDB");
		var myquery = { name: varname};
		dbo.collection("listings").deleteOne(myquery, function(err,response){
			if (err) throw err;
			console.log("1 listing deleted");
			db.close();
			});
		});
	}
	removelis(name);
	res.redirect("/main");
});

//This is for updating listing, you can update by button press (needs to be implemented by john)
app.post('/update_lis',(req,res)=>{
	var textname = req.body.name;
	var condition = req.body.condition;
	var description = req.body.descript;
	function addchild(varname,varcon,vardesc){
	MongoClient.connect(DB_Url,function(err,db){
	  if (err) throw err;
		var dbo = db.db("ecomDB");
		var myquery = { name: varname};
		if(varcon.length == 0 && vardesc.length == 0){
			console.log("Nothing to update");
		}
		else if(varcon.length == 0){
		var newvalues = { $set: {description: vardesc}};
		dbo.collection("children").updateOne(myquery, newvalues, function(err,response){
			if (err) throw err;
			console.log("only description updated");
			db.close();
			});
		
		} else if(vardesc.length == 0){
		var newvalues = { $set: {condition: varcon}};
		dbo.collection("children").updateOne(myquery, newvalues, function(err,response){
			if (err) throw err;
			console.log("only condition updated");
			db.close();
			});
		} else{
		var newvalues = { $set: {condition: varcon, description: vardesc}};
		dbo.collection("children").updateOne(myquery, newvalues, function(err,response){
			if (err) throw err;
			console.log("1 document updated");
			db.close();
			});
			}
		});
	}
	addchild(name,condition,description);
	res.redirect("/postingpage");
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////// Maybe we should talk about the offers part of this project. /////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/make-offer',(req,res)=>{
	var name = req.body.name;
	var subject = req.body.sub; //this is suppopsed to be the name of the textbook you are making an offer for. TODO make sure to find out how to get the specific name
	var reason = req.body.reason;
	var datetime = new Date();
	function addoffer(varname,varsubject,varreason,date){
		MongoClient.connect(DB_Url,function(err,db){
			var dbo = db.db("ecomDB");
			var myobj = {name: varname, subject: "offer for: " + varsubject, reason: varreason, timestamp: datetime};
			dbo.collection("offers").insertOne(myobj, function(err,response){
				if (err) throw err;
				console.log("inserted into offers succesfully");
				db.close();
			});
			
		});
	}
	addoffer(name,subject, reason, datetime);
	res.redirect("/main");
});



//This was to get the offers and to display them (might change depending on how john actually wants to implement this.)
//maybe also use this for messages in general
//i have it grab all from one subject maybe figure out how to automatically get it from pushing reply (maybe just have the offer button on each posting instead)
app.get('/get-offers',function(req,res){    
    var subject = req.body.sub;//change this
    var options = {
        root: path.join(__dirname)
    };
	var resultArray = [];
	MongoClient.connect(DB_Url,function(err,db){
	  if (err) throw err;
	  	var dbo = db.db("ecomDB");
	  	var cursor = dbo.collection('offers').find(subject);
		cursor.forEach(function(doc,err){
			if (err) throw err;
			resultArray.push(doc);
		}, function(){
			console.log(resultArray);
			db.close();
			res.send(resultArray);
		});
	});
});


app.post('add-to-wishlist', (req, res) => {

    var listingID = req.body.listingID;       // this is the id of the listing to be added to the wishlist
    var user = req.session.user.username;
    //var userID = req.body.userID;

    async function addToWishlist(){

        try{
            const users = await con.collection(userCollection);

            await users.updateOne({username : user}, {$push : {wishlist : listingID}});

        }
        catch{
            console.log(error);
            res.status(400).send(error);
        }
    };

    (async function() {
        await addToWishlist();

        res.send("ok");
    })();


})


app.post('/user/wishlist', (req, res) => {

    //var id = req.body.id;
    var username = req.session.user.username;


    async function getUser(){

        try{
            const users = await con.collection(userCollection);

            let user = await users.findOne({username : username});

            return user;
        }
        catch{
            console.log(error);
            res.status(400).send(error);
        }

    };

    async function getWishlist(user){

        try{

            const listingIDs = [];

            const userWishlist = await user.wishlist;

            for await (const listingID of userWishlist){
                listingIDs.push(listingID);
            }

            return listingIDs;

        }
        catch{
            console.log(error);
            res.status(400).send(error);
        }


    };

    async function getListings(listingIDs){

        try{

            const listings = await con.collection(listingsCollection);

            const books = [];

            for await (const listingID of listingIDs){
                let listing = await listings.findOne({_id : listingID});

                books.push(listing.title);

            }


        }
        catch{
            console.log(error);
            res.status(400).send(error);
        }


    };

    (async function() {

        var user = await getUser();

        var wishlist = await getWishlist(user);

        var listings = await getListings(wishlist);

        res.send(listings);

    })();





});



 
//This is just to testing stuff
app.get('/', (req, res) => {
    //res.redirect("http://localhost:3000/");
    //res.send("Hey");
    res.redirect("http://localhost:3000/register");
});

app.use('/', express.static('pages'));


app.listen(PORT, HOST);

console.log('up and running');
