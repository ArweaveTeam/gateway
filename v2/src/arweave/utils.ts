import { fromB64Url } from "../lib/encoding";
import { Tag } from "./interfaces";

export const getUtf8TagValue = (
  tags: Tag[],
  name: string
): string | undefined => {
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
