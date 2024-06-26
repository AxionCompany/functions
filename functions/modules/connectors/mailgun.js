import Mailgun from "https://deno.land/x/mailgun@v1.1.0/index.ts";

export default ({ config }) => {
    // Create a instance using your Mailgun API key and domain
    return new Mailgun({
        key: config.key,
        domain: config.domain,
    });
}