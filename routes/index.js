var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var request = require('request');
var ActiveDirectory = require('activedirectory');

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '@v3p@$$w0rd',
    database: 'dlslcaptiveportal'
});

router.get('/terms', function (req, res) {
    res.render('terms',
        {
            title: 'Terms and Conditions',
        });
});

// GET Capture Student Mac Address
router.get('/', function (req, res) {
    res.render('login',
        {
            title: 'Log-In Page',
            studentmac: req.query.mac
        });
});

// Authenticate Account to AD

router.post('/auth', function (req, res) {
    var config = {
        url: 'ldap://172.19.32.6',
        baseDN: 'dc=dlsl,dc=edu,dc=ph',
    }

    var ad = new ActiveDirectory(config);
    ad.authenticate(req.body.studentusername, req.body.studentpassword, function (err, auth) {
        if (err) {
            console.log('ERROR :' + JSON.stringify(err));
            res.render('login', { title: 'Log-In Page', errors: "Incorrect Username or Password", studentmac: req.query.mac });
        }

        if (auth) {
            console.log('Authenticated');
            var querytext = "SELECT * from students where studentusername='" + req.body.studentusername.toLowerCase() + "'";
            var query = connection.query(querytext, function (err, result) {
                if (result[0] == null) {
                    insertToDatabase(req.body.studentmac, req.body.studentusername.toLowerCase(), res);
                } else {
                    var querytext3 = "SELECT * from students where studentmac='" + req.body.studentmac + "'";
                    var query3 = connection.query(querytext3, function (err, result3) {
                        if (result3[0] == null) {
                            var querytext2 = "SELECT Count(*) as studentcount from students where studentusername='" + req.body.studentusername + "'";
                            var query2 = connection.query(querytext2, function (err, result2) {
                                console.log(result2[0].studentcount);
                                if (result2[0].studentcount >= 2) {
                                    deleteFromDatabase(result[0].studentmac, req.body.studentmac, req.body.studentusername.toLowerCase(), res);
                                } else {
                                    insertToDatabase(req.body.studentmac, req.body.studentusername.toLowerCase(), res);
                                }
                            });
                        } else {
                            console.log("ALREADY REGITERED DEVICE");
                            res.render('addmac', {
                                title: 'Registration Successful',
                                studentmac: req.body.studentmac,
                                studentusername: req.body.studentusername
                            });
                        }
                    });
                }
            });
        }
    });
});

function deleteFromDatabase(oldstudentmac, studentmac, studentusername, res) {
    var query = connection.query("DELETE FROM students WHERE studentusername='" + studentusername + "' AND studentmac ='" + oldstudentmac + "'", function (err, rows) {
        if (err) {
            console.log("ERROR: Delete Failed");
            res.render('login', { title: 'Log-In Page', errors: "ERROR", studentmac: studentmac });
        }
        else {
            deleteFromIgnition(oldstudentmac, studentmac, studentusername, res);
            console.log("SUCCESS: Deleted in Database");
        }
    });
}

function deleteFromIgnition(oldstudentmac, studentmac, studentusername, res) {
    console.log("DELETE FROM IGNITION: " + studentmac)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    var delOptions = {
        method: 'DELETE',
        uri: 'https://172.19.32.2/GuestManager/api/devices/' + oldstudentmac,
        headers: {
            "api-version": "v2.0",
            "Authorization": "Basic cHJvdmlzaW9uZXIxOnByb3Zpc2lvbmVyMQ==",
            "Content-Type": "application/json"
        }
    };

    request(delOptions, function (error, response, body) {
        if (error) {
            console.log(error);
        } else {
            insertToDatabase(studentmac, studentusername, res)
            console.log(response.statusCode);
            console.log(response.statusMessage);
            console.log(response.body);
        }
    });
}

function insertToDatabase(studentmac, studentusername, res) {
    var data = {
        studentmac: studentmac,
        studentusername: studentusername
    };

    var query = connection.query("INSERT into students set ?", data, function (err, rows) {
        if (err) {
            console.log("ERROR: Not saved in Database");
            res.render('login', { title: 'Log-In Page', errors: "ERROR", studentmac: studentmac });
        }
        else {
            insertToIgnition(studentmac, studentusername, res);
            console.log("SUCCESS: Saved in Database");
        }
    });
}

function insertToIgnition(studentmac, studentusername, res) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    var postOptions = {
        method: 'POST',
        uri: 'https://172.19.32.2/GuestManager/api/devices',
        headers: {
            "api-version": "v2.0",
            "Authorization": "Basic cHJvdmlzaW9uZXIxOnByb3Zpc2lvbmVyMQ==",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "Device": {
                "provisioningGroupName": "Guest_Access",
                "macAddress": studentmac,
                "name": studentusername,
                "type": "mobile",
                "networkRights": "Internet",
                "subType": "generic-android"
            }
        })
    };
    request(postOptions, function (error, response, body) {
        if (error) {
            console.log(error);
        } else {

            console.log(response.statusCode);
            console.log(response.statusMessage);
            console.log(body);
            res.render('addmac', {
                title: 'Registration Successful',
                studentmac: studentmac,
                studentusername: studentusername
            });
        }
    });
}

module.exports = router;