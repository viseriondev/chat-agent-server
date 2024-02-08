import mongoose from "mongoose";

export interface AgentSchemaProps {
     name: string;
     email: string;
     password: string;
}

const AgentSchema = new mongoose.Schema<AgentSchemaProps>(
     {
          email: { type: mongoose.Schema.Types.String, required: true },
          name: { type: mongoose.Schema.Types.String, required: true },
          password: { type: mongoose.Schema.Types.String, required: true },
     },
     {
          timestamps: true,
     }
);

export const Agent = mongoose.model("MasterAgent", AgentSchema);
