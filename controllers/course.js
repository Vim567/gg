import TryCatch from "../middlewares/TryCatch.js";
import { Courses } from "../models/Courses.js";
import { Lecture } from "../models/Lecture.js";
import { User } from "../models/User.js";
import { Payment } from "../models/Payment.js";
import { Progress } from "../models/Progress.js";
import paypal from "@paypal/checkout-server-sdk";

// PayPal client setup
const Environment =
  process.env.PAYPAL_ENVIRONMENT === "live"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
);

// Fetch all courses
export const getAllCourses = TryCatch(async (req, res) => {
  const courses = await Courses.find();
  res.json({ courses });
});

// Fetch a single course by ID
export const getSingleCourse = TryCatch(async (req, res) => {
  const course = await Courses.findById(req.params.id);
  res.json({ course });
});

// Fetch lectures for a specific course
export const fetchLectures = TryCatch(async (req, res) => {
  const lectures = await Lecture.find({ course: req.params.id });
  const user = await User.findById(req.user._id);

  if (user.role === "admin") {
    return res.json({ lectures });
  }

  if (!user.subscription.includes(req.params.id)) {
    return res.status(400).json({ message: "You have not subscribed to this course" });
  }

  res.json({ lectures });
});

// Fetch a specific lecture by ID
export const fetchLecture = TryCatch(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  const user = await User.findById(req.user._id);

  if (user.role === "admin") {
    return res.json({ lecture });
  }

  if (!user.subscription.includes(lecture.course)) {
    return res.status(400).json({ message: "You have not subscribed to this course" });
  }

  res.json({ lecture });
});

// Fetch courses subscribed by the user
export const getMyCourses = TryCatch(async (req, res) => {
  const courses = await Courses.find({ _id: req.user.subscription });
  res.json({ courses });
});

// PayPal Checkout
export const checkout = TryCatch(async (req, res) => {
  const user = await User.findById(req.user._id);
  const course = await Courses.findById(req.params.id);

  if (user.subscription.includes(course._id)) {
    return res.status(400).json({ message: "You already have this course" });
  }

  // Create PayPal order
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      amount: {
        currency_code: "USD", // Use appropriate currency
        value: course.price.toString(),
      },
    }],
  });

  const order = await paypalClient.execute(request);

  res.status(201).json({
    orderID: order.result.id,
    course,
  });
});

// PayPal Payment Verification
export const paymentVerification = TryCatch(async (req, res) => {
  const { orderID } = req.body;

  // Capture the order
  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  const capture = await paypalClient.execute(request);

  if (capture.result.status === "COMPLETED") {
    // Payment success logic
    await Payment.create({
      orderID,
      captureID: capture.result.purchase_units[0].payments.captures[0].id,
      status: capture.result.status,
    });

    const user = await User.findById(req.user._id);
    const course = await Courses.findById(req.params.id);

    // Add course to user's subscription
    user.subscription.push(course._id);

    await Progress.create({
      course: course._id,
      completedLectures: [],
      user: req.user._id,
    });

    await user.save();

    res.status(200).json({ message: "Course Purchased Successfully" });
  } else {
    return res.status(400).json({ message: "Payment Failed" });
  }
});

// Add progress for a specific course
export const addProgress = TryCatch(async (req, res) => {
  const progress = await Progress.findOne({
    user: req.user._id,
    course: req.query.course,
  });

  const { lectureId } = req.query;

  if (progress.completedLectures.includes(lectureId)) {
    return res.json({ message: "Progress recorded" });
  }

  progress.completedLectures.push(lectureId);
  await progress.save();

  res.status(201).json({ message: "New Progress added" });
});

// Get progress for a specific course
export const getYourProgress = TryCatch(async (req, res) => {
  const progress = await Progress.find({
    user: req.user._id,
    course: req.query.course,
  });

  if (!progress.length) return res.status(404).json({ message: "No progress found" });

  const allLectures = (await Lecture.find({ course: req.query.course })).length;
  const completedLectures = progress[0].completedLectures.length;
  const courseProgressPercentage = (completedLectures * 100) / allLectures;

  res.json({
    courseProgressPercentage,
    completedLectures,
    allLectures,
    progress,
  });
});
