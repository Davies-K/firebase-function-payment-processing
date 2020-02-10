const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase)

const db = admin.firestore();

//express and jsonwebtoken libraries
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();





exports.readDeposits = functions.firestore
    .document('Deposits/{depositId}')
    .onCreate(async(snap, context) => {
        const newValue = snap.data();


        // access a particular field as you would any JS propety
        const amount = newValue.amount;
        //  const date = newValue.date;
        // const createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const reference = newValue.reference;
        const sender = newValue.sender;
        const transactionId = newValue.transactionId;
        //  const status = newValue.status;

        console.log(context.params.depositId);

        // await db.collection('users').doc(reference).update({
        //     last_MOMO: amount,
        //     sender: sender,
        //     transactionId: transactionId

        // })

        await db.collection('users').doc(reference).collection('Deposit_history').add({
            last_MOMO: amount,
            sender: sender,
            transactionId: transactionId,
            createdat: admin.firestore.Timestamp.now()

        })




        await db.collection('Deposits').doc(context.params.depositId).update({
            status: 'delivered',

        })

        return db.collection('users').doc(reference).get().then(snapshot => {
            return snapshot.data();
        }).then(async user => {
            balance = user.balance;

            return db.collection('users').doc(reference).update({
                balance: balance + amount,
            })
        })


    })

// exports.updateAmount=functions.firestore.document('users/{userId}/history').onUpdate((change, context) => {

//   const newAmount = change.after.data().last_MOMO;


//   const lastBalance = change.before.data().currentBalance;



//   return db.collection('users').doc(context.params.userId).update({
//     currentBalance : lastBalance + newAmount

//   })

// })

// exports.reduceAmount = functions.firestore.document('users/{userId}/purchases').onUpdate((change, context) => {
//   const newAmount = change.after.data()
// })


exports.geniusCharge = functions.firestore.document('pending_orders/{paymentId}').onCreate(
    async(snap, context) => {
        const payment = snap.data();
        const userId = payment.userId;
        const paymentId = context.params.paymentId;
        const pd_statsRef = db.collection('pending_orders').doc('--stats--');

        //Data aggregation
        // const increment = admin.firestore.FieldValue.increment(1);
        // const decrement = admin.firestore.FieldValue.decrement(-1);
        // const increaseBy = admin.firestore.FieldValue.increment(payment.amount);

        pd_statsRef.update({
            reads: admin.firestore.FieldValue.increment(1)
        })

        let balance = 0;

        await db.collection('users').doc(userId).collection('pending_orders').doc(paymentId).set({
            amount: payment.amount,
            itemId: payment.itemId,
            createdat: admin.firestore.Timestamp.now()
        })

        //Send requests to the payment endpoint








        //checks if payment exists or if it has already been charged
        // if (!payment || payment.charge) return;

        return db.collection('users').doc(userId).get()
            .then(snapshot => {
                return snapshot.data();


            }).then(async customer => {

                balance = customer.balance;

                const amount = payment.amount;
                const idempotency_key = paymentId; // prevent duplicate charges
                const source = payment.token.token_id; // this should be sent from the payment pre processor engine
                const currency = 'GHS';

                //Do some more sanitize of the data 
                //and do account balance checks here

                //Mock user 
                const user = {
                    id: customer.uid,
                    username: customer.username,
                    email: customer.email
                }

                if (customer.balance < amount || customer.balance == 0) return;
                if (customer.balance > amount) {
                    //generate token and Send Https request to payment gateway


                    jwt.sign({ user }, 'secretkey', { expiresIn: '500s' }, (err, token) => {
                            // res.json({
                            //     token
                            // })
                            const request = require('request');
                            const options = {
                                url: 'https://us-central1-thumbnailgen-61476.cloudfunctions.net/app//api/posts',
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Accept-Charset': 'utf-8',
                                    'Authorization': 'Bearer' + ' ' + token

                                }
                            }
                            request(options, function(err, res, body) {
                                //check if token is not expired
                                //susbscribe to authdata and check if it matches the database
                                let json = JSON.parse(body);
                                console.log(json);
                            })

                        })
                        //you can have a token here that we check for valid user and account uniqueness


                    //if 404 error .. handle error 

                    //if response is https 200 ok
                    //Response should have this data format 
                    //       charge: {
                    //           amount: amount,
                    //           idempotency_key: idempotency_key,
                    //           currency: currency,
                    //           source: source,
                    //           outcome: {

                    //               network_status: "approved_by_network",
                    //               risk_level: "normal",
                    //               seller_message: "Payment Complete",
                    //               type: "authorized"
                    //           },


                    //           fingerprint: 'allowed',
                    //           status: "succeeded",
                    //           paid: 'true',
                    //           refunded: 'false',
                    //           itemId: 'Special itemId',
                    //           createdat: admin.firestore.Timestamp.now()
                    //       }


                    //Batch write to Successful_payments and User payments Subcollection

                    // Get a new write batch
                    let batch = db.batch();

                    // Set idempotency_key to prevent duplication

                    let receipts = db.collection('Successful_payments').doc(idempotency_key);
                    // if (receipts) return;
                    batch.set(receipts, {
                        amount: amount,
                        idempotency_key: idempotency_key,
                        currency: currency,
                        source: source,
                        outcome: {

                            network_status: "approved_by_network",
                            risk_level: "normal",
                            seller_message: "Payment Complete",
                            type: "authorized"
                        },


                        fingerprint: 'allowed',
                        status: "receipt",
                        paid: 'true',
                        refunded: 'false',
                        itemId: payment.itemId,
                        userId: userId,
                        createdat: admin.firestore.Timestamp.now()

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

                    // Delete the pending_order(DocId) and user_pending_order(DocId)
                    let pd_Ref = db.collection('pending_orders').doc(idempotency_key);
                    batch.delete(pd_Ref);

                    let usr_pd_Ref = db.collection('users').doc(userId).collection('pending_orders').doc(idempotency_key);
                    batch.delete(usr_pd_Ref)

                    // Document reference for --stats-- increment and decrement
                    let Sc_statsRef = db.collection('Successful_payments').doc('--stats--');


                    // Update read count
                    batch.update(Sc_statsRef, {
                        reads: admin.firestore.FieldValue.increment(1),
                        total_amount: admin.firestore.FieldValue.increment(payment.amount)
                    });

                    batch.update(pd_statsRef, {
                        reads: admin.firestore.FieldValue.increment(-1)

                    })

                    // Commit the batch
                    return batch.commit().then(function() {
                        console.log("batch succeeded")
                    });


                    // await db.collection('Receipts').add({
                    //     amount: amount,
                    //     idempotency_key: idempotency_key,
                    //     currency: currency,
                    //     source: source,
                    //     outcome: {

                    //         network_status: "approved_by_network",
                    //         risk_level: "normal",
                    //         seller_message: "Payment Complete",
                    //         type: "authorized"
                    //     },


                    //     fingerprint: 'allowed',
                    //     status: "receipt",
                    //     paid: 'true',
                    //     refunded: 'false',
                    //     itemId: 'Special itemId',
                    //     userId: userId,
                    //     createdat: admin.firestore.Timestamp.now()

                    // });


                    // await db.collection('users').doc(userId).collection('purchases').add({
                    //     amount: amount,
                    //     itemId: 'Special itemId',
                    //     userid: userId,
                    //     createdat: admin.firestore.Timestamp.now()


                    // })





                    // //asynchronously 

                    // return db.collection('users').doc(userId).update({
                    //     balance: balance - amount,
                    //     Last_expense: admin.firestore.Timestamp.now()
                    // })

                }




            })





    }
)


exports.createUserdata = functions.firestore.document('tmp_users/{userId}').onCreate(
    async(snap, context) => {

        const genData = snap.data();
        const password = genData.password;
        const displayName = genData.displayName;
        const email = genData.email;
        const userId = context.params.userId;

        await admin.auth().createUser({
                email: email,
                emailVerified: false,
                disabled: false,
                password: password,
                displayName: displayName,


            }).then(async(userRecord) => {

                await db.collection('users').doc(userRecord.uid).set({
                    email: email,
                    emailVerified: false,
                    disabled: false,
                    password: password,
                    displayName: displayName,

                })
                return db.collection('tmp_users').doc(userId).delete();
            })
            .catch((error) => {
                console.log('Error creating new user:', error);


            })
    })


exports.stripe_charge = functions.firestore.document('stripe_payments/{paymentId}').onCreate(
    async(snap, context) => {
        const payment = snap.data();
        const userId = payment.userId;
        const payment = context.params.paymentId;


        let balance = 0;

        return db.collection('users').doc(userId).get()
            .then(snapshot => {
                return snapshot.data();

            }).then(async customer => {
                balance = customer.balance;

                const amout = paymount.amount;
                const idempotency_key = paymentId //prevent duplicate chrges
                const source = payment.token.token_id;

                if (customer.balance > amount && !payment.charge) {
                    const request = require('request');
                    const options = {
                        url: 'http://localhost:5000/api/charge',
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
                    })

                } else {
                    console.log("your balance is low for this purchase")


                }
            })

    }
)