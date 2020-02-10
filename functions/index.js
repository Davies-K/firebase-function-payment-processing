const functions = require('firebase-functions');
const admin = require('firebase-admin');
const request = require('request');
admin.initializeApp(functions.config().firebase)

const db = admin.firestore();
// const express = require('express');
// const jwt = require('jsonwebtoken');

// const app = express();

// app.get('/api', (req, res) => {
//     res.json({
//         message: 'Welcome to the PaymentAPI'
//     });
// });

// app.post('/api/createToken', (req, res) => {
//     //Mock user 
//     // const user = {
//     //     id: 1,
//     //     username: 'brad',
//     //     email: 'brad@gmail.com'
//     // }

//     let user = req.user


//     jwt.sign({ user }, 'secretkey', { expiresIn: '500s' }, (err, token) => {
//         res.json({
//             user: user,
//             token: {
//                 token_id: token,
//                 amount: req.user.amount,

//             }

//         })

//     })
// })

// app.post('/api/posts', verifyToken, (req, res) => {
//     jwt.verify(req.token, 'secretkey', (err, authData) => {
//         if (err) {
//             res.sendStatus(403);
//         } else {
//             res.json({
//                 message: 'Post created...',
//                 authData
//             })
//         }

//     })

// })

// //Format of Token
// //Authorization : Bearer <access_token>

// // Verify Token 
// function verifyToken(req, res, next) {

//     //Get auth header value
//     const bearerHeader = req.headers['authorization'];
//     //check if bearer is undefined
//     if (typeof bearerHeader !== 'undefined') {

//         //split at the space 
//         const bearer = bearerHeader.split(' ');
//         //get token from array
//         const bearerToken = bearer[1];
//         //set the token
//         req.token = bearerToken;
//         // Next middleware
//         next();
//     } else {
//         //Forbidden
//         res.sendStatus(403)
//             // res.json({
//             //     message: 403
//             // })
//     }


// }
// app.listen(5000, () => console.log('Servre started on port 5000'))

// exports.app = functions.https.onRequest(app)

exports.stripe_charge = functions.firestore.document('stripe_payments/{paymentId}').onCreate(
    async(snap, context) => {
        const payment = snap.data();
        const userId = payment.userId;
        const paymentId = context.params.paymentId;


        let balance = 0;

        return db.collection('users').doc(userId).get()
            .then(snapshot => {
                return snapshot.data();

            }).then(async customer => {
                balance = customer.balance;

                // const amout = payment.amount;
                const idempotency_key = paymentId //prevent duplicate chrges
                const source = payment.token.token_id;

                if (customer.balance > payment.amount) {

                    const options = {
                        url: 'https://us-central1-thumbnailgen-61476.cloudfunctions.net/app/api/charge',
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-Charset': 'utf-8',
                            'Authorization': 'Bearer' + ' ' + source

                        }
                    }
                    request(options, function(err, res, body) {
                        //check if token is not expired
                        //susbscribe to authdata and check if it matches the database
                        let json = JSON.parse(body);
                        console.log(json);
                        // writing atomically

                        let batch = db.batch();
                        //update stripe_payments with charge object   
                        let updRef = db.collection('stripe_payments').doc(paymentId);
                        batch.update(updRef, {
                            charge: {
                                json
                            }

                        });

                        // Update the users payments collection with docId (idempotency_key)
                        let sfRef = db.collection('users').doc(userId).collection('payments').doc(idempotency_key)
                        batch.set(sfRef, {
                            amount: amount,
                            itemId: payment.itemId,
                            userid: userId,
                            createdat: admin.firestore.Timestamp.now()


                        });

                        //Update user balance 
                        let blnce = db.collection('users').doc(userId);
                        batch.update(blnce, {
                            balance: balance - amount,
                            Last_expense: admin.firestore.Timestamp.now()

                        });

                        // Commit the batch
                        return batch.commit().then(function() {
                            console.log("batch succeeded")
                        });

                    })

                } else {
                    console.log("your balance is low for this purchase")


                }
            })

    }
)