import { fromB64Url } from "../lib/encoding";
import { Tag } from "./interfaces";
import { AxiosError } from "axios";
export const getTagValue = (tags: Tag[], name: string): string | undefined => {
  const contentTypeTag = tags.find((tag) => {
    try {
      return (
        fromB64Url(tag.name).toString().toLowerCase() == name.toLowerCase()
      );
    } catch (error) {
      return undefined;
    }
  });
  try {
    return contentTypeTag
      ? fromB64Url(contentTypeTag.value).toString()
      : undefined;
  } catch (error) {
    return undefined;
  }
};

export const isAxiosError = (error: any): error is AxiosError =>
  error && error.isAxiosError;
