import Mailgun from "https://deno.land/x/mailgun@v1.1.0/index.ts";
// import "https://deno.land/std@0.208.0/dotenv/load.ts";

// Create a instance using your Mailgun API key and domain
const mailgun = new Mailgun({
    key: Deno.env.get("MAILGUN_KEY"),
    domain: Deno.env.get("MAILGUN_DOMAIN"),
});

const sendEmail = async (emailData) => {
    // Send your message off to Mailgun!
    return await mailgun.send(emailData);
}

export default {
    sendEmail,
}
