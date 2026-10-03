import { createApp } from "./app";
import { createDb } from "./db";
import { lookupPostcode } from "./providers/idealpostcodes";

const PORT = process.env.PORT || 3000;

const main = async () => {
	const db = await createDb();
	const app = createApp({ db, geocode: lookupPostcode });

	app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
};

main();
