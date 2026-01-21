const functions = require("firebase-functions");
const admin = require("firebase-admin");
const SibApiV3Sdk = require('@sendinblue/client');

// Initialize the app
admin.initializeApp();
const db = admin.firestore();

// Configure the Brevo API
const BREVO_API_KEY = functions.config().brevo.key;
let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.apiClient.authentications['api-key'].apiKey = BREVO_API_KEY;

// This is the *exact* email address you verified as a Sender in Brevo
const SENDER_EMAIL = "2k24.cs1p2414192@gmail.com"; 
const SENDER_NAME = "Friendship Zone";

/**
 * This function triggers when *any* user document is updated.
 */
exports.sendFriendRequestEmail = functions.firestore
    .document("/artifacts/{appId}/public/data/users/{userId}")
    .onUpdate(async (change, context) => {

        // Get the data *before* and *after* the change
        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Check if a new pendingRequest was added
        if (afterData.pendingRequests.length > beforeData.pendingRequests.length) {
            console.log("New pending request found.");

            // Find the new request UID that wasn't in the old list
            const senderUid = afterData.pendingRequests.find(uid => 
                !beforeData.pendingRequests.includes(uid)
            );

            if (!senderUid) {
                console.log("Could not determine sender UID.");
                return null;
            }

            // Get the sender's user document
            const appId = context.params.appId;
            const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
            const senderDocRef = db.doc(`${usersCollectionPath}/${senderUid}`);
            const senderSnap = await senderDocRef.get();

            if (!senderSnap.exists) {
                 console.log("Sender document does not exist.");
                 return null;
            }

            const senderName = senderSnap.data().name;
            const receiverEmail = afterData.email; // The email of the user who *received* the request
            const receiverName = afterData.name;

            console.log(`Sending email via Brevo to ${receiverEmail} from ${senderName}`);

            // 3. Create the email message
            let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

            sendSmtpEmail.to = [{ email: receiverEmail, name: receiverName }];
            sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };
            sendSmtpEmail.subject = "You have a new friend request!";
            sendSmtpEmail.htmlContent = `
                <p>Hi ${receiverName},</p>
                <p>You have a new friend request from <strong>${senderName}</strong>.</p>
                <p>Log in to the Friendship Zone app to accept it!</p>
                <br>
                <p>- The Friendship Zone Team</p>
            `;
            sendSmtpEmail.textContent = `Hi ${receiverName},\n\nYou have a new friend request from ${senderName}.\n\nLog in to the Friendship Zone app to accept it!`;


            // 4. Send the email
            try {
                await apiInstance.sendTransacEmail(sendSmtpEmail);
                console.log("Email sent successfully!");
            } catch (error) {
                console.error("Error sending email:", error.message);
            }
        }
        return null; // All done
    });