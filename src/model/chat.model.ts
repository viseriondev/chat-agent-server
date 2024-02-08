import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
     {
          messages: [
               {
                    body: { type: mongoose.Schema.Types.String, required: true },
                    userType: { type: mongoose.Schema.Types.String, required: true },
                    msgOn: { type: mongoose.Schema.Types.Date },
               },
          ],
          roomId: { type: mongoose.Schema.Types.String, required: true },
          agentId: { type: mongoose.Schema.Types.String },
     },
     {
          timestamps: true,
     }
);

export const Chat = mongoose.model("Chat", ChatSchema);
