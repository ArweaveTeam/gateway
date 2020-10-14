import cors from "cors";

export const corsHandler = cors();

// export const corsHandler: RequestHandler = (req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST");
//   res.header("Access-Control-Allow-Headers", "Content-Type");

//   if (req.method == "OPTIONS") {
//     return res.status(200).end();
//   }

//   next();
// };
