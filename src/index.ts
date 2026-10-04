import { createApp } from "./app";
import { createDb } from "./db";
import { lookupPostcode } from "./providers/idealpostcodes";
import { sendEmail } from "./providers/sendgrid";

const PORT = process.env.PORT || 3000;

const main = async () => {
	const db = await createDb();
	const app = createApp({ db, geocode: lookupPostcode, sendEmail });

	app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
};

main();
