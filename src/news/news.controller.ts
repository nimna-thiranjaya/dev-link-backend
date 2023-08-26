import { Request, Response } from "express";
import { startSession } from "mongoose";
import { StatusCodes } from "http-status-codes";

import News from "./news.model";
import commonService from "../common/common.service";
import CustomResponse from "../util/response";
import newsService from "./news.service";

import NotFoundError from "../error/error.classes/NotFoundError";
import BadRequestError from "../error/error.classes/BadRequestError";
import ForbiddenError from "../error/error.classes/ForbiddenError";
import constants from "../constant";

const CreateNews = async (req: Request, res: Response) => {
  let body: any = req.body;
  let file: any = req.file;
  let auth: any = req.auth;

  if (!file) {
    throw new BadRequestError("News image is required!");
  }

  //construct news object
  const newNews: any = new News(body);
  newNews.addedBy = auth._id;

  //start mongoose session
  const session = await startSession();

  let createdNews = null;
  try {
    //start transaction in session
    session.startTransaction();

    //upload image to cloudinary
    let uploadedObj: any = null;
    if (file) {
      uploadedObj = await commonService.uploadImageAndGetUri(
        file,
        constants.CLOUDINARY.FILE_NAME + "/news"
      );
    }

    if (uploadedObj != null) {
      newNews.newsImage = uploadedObj;
    }

    //save news
    createdNews = await newsService.save(newNews, session);

    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }

  CustomResponse(
    res,
    true,
    StatusCodes.CREATED,
    "News created successfully!",
    createdNews
  );
};

//Get all active news for admin and user
const GetAllActiveNews = async (req: Request, res: Response) => {
  let auth = req.auth;

  let activeNews: any[] = [];
  if (auth.role === constants.USER.ROLES.USER) {
    activeNews = await newsService.findAllActiveNews();
  } else if (auth.role === constants.USER.ROLES.ADMIN) {
    activeNews = await newsService.findAllActiveNewsByAddedUser(auth._id);
  }

  CustomResponse(res, true, StatusCodes.OK, "", activeNews);
};

//Delete news by id for admin
const DeleteNews = async (req: Request, res: Response) => {
  let newsId = req.params.id;
  let auth: any = req.auth;

  let news: any = await newsService.findById(newsId);
  if (auth._id == news.addedBy._id)
    throw new ForbiddenError("You are not allow to delete this news!");

  if (news) {
    news.status = constants.WELLKNOWNSTATUS.DELETED;
    await news.save();

    CustomResponse(res, true, StatusCodes.OK, "News deleted successfully!", {});
  } else {
    throw new NotFoundError("News not found!");
  }
};

//Update news by id for admin
const UpdateNews = async (req: Request, res: Response) => {
  let newsId: string = req.params.id;
  let auth: any = req.auth;
  let body: any = req.body;
  let file: any = req.file;

  let news: any = await newsService.findById(newsId);

  console.log(news);

  if (!news) throw new NotFoundError("News not found!");

  if (auth._id == news.addedBy._id)
    throw new ForbiddenError("You are not allow to delete this news!");

  //construct news update object expect image and
  for (let key in body) {
    if (key !== "newsImage" && key !== "addedBy") {
      news[key] = body[key];
    }
  }

  //start mongoose session
  const session = await startSession();
  let updatedNews = null;

  try {
    //start transaction in session
    session.startTransaction();

    //upload image to cloudinary
    let uploadedObj: any = null;
    if (file) {
      uploadedObj = await commonService.uploadImageAndGetUri(
        file,
        constants.CLOUDINARY.FILE_NAME + "/news"
      );

      //delete old image from cloudinary
      if (news.newsImage.public_id) {
        await commonService.deleteImageByUri(news.newsImage.public_id);
      }

      if (uploadedObj) {
        news.newsImage = uploadedObj;
      }
    }

    //save news
    updatedNews = await newsService.save(news, session);

    await session.commitTransaction();
  } catch (e) {
    session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }

  CustomResponse(
    res,
    true,
    StatusCodes.OK,
    "News updated successfully!",
    updatedNews
  );
};

export { CreateNews, GetAllActiveNews, DeleteNews, UpdateNews };
