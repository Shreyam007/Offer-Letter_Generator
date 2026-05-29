import mongoose from 'mongoose';

const candidateSchema = mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, default: '' },
    department: { type: String, default: '' },
    salary: { type: String, default: '' },
    joiningDate: { type: String, default: '' },
    openedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Pending', 'Validated', 'Invalid Email', 'Sending', 'Sent', 'Failed', 'Retrying', 'Opened'],
      default: 'Pending'
    },
    error: { type: String, default: '' },
    customFields: { type: Map, of: String, default: {} } // For any other CSV columns
  },
  { timestamps: true }
);

const Candidate = mongoose.model('Candidate', candidateSchema);
export default Candidate;
