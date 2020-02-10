const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase)

const db = admin.firestore();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });


exports.readDeposits = functions.firestore
    .document('Deposits/{depositId}')
    .onCreate(async(snap, context) => {
        // Get an object representing the document
        // e.g. {'name': 'Marie', 'age': 66}
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

        await db.collection('users').doc(reference).collection('history').add({
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


exports.geniusCharge = functions.firestore.document('payments/{paymentId}').onCreate(
    (snap, context) => {
        const payment = snap.data();
        const userId = payment.userId;
        const paymentId = context.params.paymentId;

        let balance = 0;

        //checks if payment exists or if it has already been charged
        if (!payment || payment.charge) {
            return
        } else {
            return db.collection('users').doc(userId).get()
                .then(snapshot => {
                    return snapshot.data();


                }).then(async customer => {

                    balance = customer.balance;

                    const amount = payment.amount;
                    const idempotency_key = paymentId; // prevent duplicate charges
                    const source = payment.token.token_id;
                    const currency = 'GHS';


                    if (customer.balance < amount || customer.balance == 0) return;

                    if (customer.balance > amount) {


                        await db.collection('payments').doc(paymentId).update({
                            charge: {
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
                                status: "succeeded",
                                paid: 'true',
                                refunded: 'false',
                                itemId: 'Special itemId',
                                createdat: admin.firestore.Timestamp.now()
                            }
                        });

                        await db.collection('Receipts').add({
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
                            itemId: 'Special itemId',
                            userId: userId,
                            createdat: admin.firestore.Timestamp.now()

                        });


                        await db.collection('users').doc(userId).collection('purchases').add({
                            amount: amount,
                            itemId: 'Special itemId',
                            userid: userId,
                            createdat: admin.firestore.Timestamp.now()


                        })






                        return db.collection('users').doc(userId).update({
                            balance: balance - amount,
                            Last_expense: admin.firestore.Timestamp.now()
                        })

                    }




                })

        }







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