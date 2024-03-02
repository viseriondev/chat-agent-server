import Express, { Request, Response } from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";
import cors, { CorsOptions } from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";
import { Agent, Chat } from "./model";
import bcrypt, { compareSync } from "bcrypt";
import jwt from "jsonwebtoken";
import moment from "moment";
import axios from "axios";

dotenv.config();
// application server
const app = Express();
const host = http.createServer(app);
// cors config
const corsConfig: CorsOptions = {
     origin: ["http://localhost:3000/", "http://localhost:3000", "http://localhost:3001/", "http://localhost:3001"],
};
app.use(morgan("dev"));
app.use(cors(corsConfig));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// socket initialization
const io = new Server(host, {
     cors: {
          origin: [
               "http://localhost:3000/",
               "http://localhost:3000",
               "http://localhost:3001/",
               "http://localhost:3001",
          ],
     },
});

// database connection
const MongoDB = async (url: string) => {
     try {
          await mongoose.connect(url);
          console.log("Connected to database");
     } catch (err) {
          console.log(err);
     }
};

// call database function
MongoDB(process.env.DATABASE as string);

var id: string = "";

// socket apis
io.on("connection", async (socket) => {
     socket.on("userConnected", async (state) => {
          id = state;
          const chat = await Chat.findOne({ roomId: id });
          socket.join(id);
          if (chat) {
               await Chat.updateOne(
                    { roomId: state },
                    {
                         $push: {
                              messages: {
                                   body: `Student re-connected With ${state}`,
                                   userType: "SYSTEM",
                                   msgOn: new Date(),
                              },
                         },
                    }
               );
               socket.emit("useChatData", chat);
          } else {
               await new Chat({
                    roomId: id,
                    messages: [{ body: `Student Connected With ${state}`, userType: "SYSTEM", msgOn: new Date() }],
               }).save();
               socket.emit("useChatData", chat);
          }

          const newChat = await Chat.findOne({ roomId: state });
          socket.emit("useChatData", newChat);
     });

     socket.on("useBot", async (message) => {
          console.log(message);
          if (message.length) {
               const botAnswer = await axios.post("http://localhost:8080/use-bot", { question: message });
               console.log(botAnswer.data.botAnswer);
               const updateData = [
                    {
                         body: message,
                         userType: "USER",
                         msgOn: new Date().toString(),
                    },
                    {
                         body: botAnswer.data.botAnswer,
                         userType: botAnswer.data.user,
                         msgOn: botAnswer.data.timeZone,
                    },
               ];
               console.log("ROOM ID", id);
               const updateMessage = await Chat.updateOne(
                    { roomId: id },
                    {
                         $push: {
                              messages: updateData,
                         },
                    },
                    {}
               );
               const chat = await Chat.findOne({ roomId: id });

               socket.emit("useChatData", chat);
          }
     });

     const chat = await Chat.find();
     socket.emit("GetAllChats", chat);
     socket.on("getRoomToJoin", async (fetchRoom) => {
          const receivedChat = await Chat.findOneAndUpdate(
               { roomId: fetchRoom },
               {
                    $push: {
                         messages: {
                              body: `agent connected on ${moment().format()}`,
                              userType: "SYSTEM",
                              msgOn: new Date(),
                         },
                    },
               }
          );

          io.emit("agentJoined", receivedChat);
     });
     socket.on("sendMessage", async (payload: any) => {
          console.log("SEND MESSAGE EVENT", payload);
          const updateMessage = await Chat.updateOne(
               { roomId: payload.roomId },
               {
                    $push: {
                         messages: {
                              body: payload.message,
                              userType: payload.userType,
                              msgOn: new Date().toString(),
                         },
                    },
               },
               {}
          );
          if (updateMessage.modifiedCount !== 0) {
               const chat = await Chat.findOne({ roomId: payload.roomId });
               socket.emit("message", chat);
          }
     });
     socket.on("getSelectedId", async (id) => {
          const fetchChatById = await Chat.findOne({ roomId: id });
          socket.emit("getChatData", fetchChatById);
     });
     socket.on("disconnect", () => {});
});

const agent: String = "agent";

app.get("/agents", async (req: Request, res: Response) => {
     try {
          const agents = await Agent.find();
          return res.status(200).json(agents);
     } catch (err) {
          return res.status(400).json(err);
     }
});

app.post(`/${agent}/login`, async (req: Request, res: Response) => {
     try {
          const { email, password } = req.body;
          console.log("data", req.body);
          if (!email || !password) {
               return res.status(401).json({
                    error: "invalid credentials",
                    statusCode: 401,
                    success: false,
               });
          } else {
               const agent = await Agent.findOne({ email });
               if (!agent) {
                    return res.status(401).json({
                         error: "no agent found with this email",
                         statusCode: 401,
                         success: false,
                    });
               }
               if (!compareSync(password, agent?.password as string)) {
                    return res.status(401).json({
                         error: "invalid password",
                         statusCode: 401,
                         success: false,
                    });
               }

               const token = jwt.sign(
                    {
                         id: agent._id,
                    },
                    "JSON_WEB_SECRET"
               );
               return res.status(200).json({
                    data: { email, token },
                    statusCode: 200,
                    success: false,
               });
          }
     } catch (err) {
          console.log(err);
          return res.status(401).json(err);
     }
});

app.post("/agent/logout", (req: Request, res: Response) => {
     try {
          res.removeHeader("Authorization");
          return res.status(200).json("logout successfully");
     } catch (err) {
          return res.status(400).json(err);
     }
});

app.get("/agent/profile", async (req: Request, res: Response) => {
     try {
          const headers = req.headers.authorization;
          if (!headers) {
               return res.status(400).json("please login");
          }
          const verify = jwt.verify(headers as string, "JSON_WEB_SECRET") as any;
          const agent = await Agent.findById({ _id: verify.id });
          return res.status(200).json(agent);
     } catch (err) {
          console.log(err);
          return res.status(400).json(err);
     }
});

app.post(`/${agent}/register`, async (req: Request, res: Response) => {
     try {
          const { email, password, name } = req.body;
          if (!email || !password || !name) {
               return res.status(401).json({
                    error: "invalid credentials",
                    statusCode: 401,
                    success: false,
               });
          } else {
               const Exist = await Agent.findOne({ email });
               if (Exist) {
                    return res.status(400).json({
                         data: "agent is already registered",
                         statusCode: 400,
                         success: false,
                    });
               }
               const agent = await new Agent({
                    name,
                    email,
                    password: bcrypt.hashSync(password, 10),
               }).save();
               return res.status(200).json({
                    data: agent,
                    statusCode: 200,
                    success: false,
               });
          }
     } catch (err) {
          return res.status(401).json(err);
     }
});

app.get("/chats", async (req: Request, res: Response) => {
     try {
          const chats = await Chat.find();
          return res.status(200).json(chats);
     } catch (err) {
          return res.status(401).json(err);
     }
});

// server configs
const PORT = process.env.PORT || 8000;

host.listen(PORT, () => {
     console.log(`Server is connected on ${PORT}`);
});
