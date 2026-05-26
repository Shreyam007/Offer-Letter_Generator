import mongoose from 'mongoose';

const historySchema = mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    status: { type: String, enum: ['Sent', 'Failed', 'Retrying'], required: true },
    error: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now }
  }
);

const History = mongoose.model('History', historySchema);
export default History;
