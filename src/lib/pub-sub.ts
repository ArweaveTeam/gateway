import { client } from './redis'

export const publish = async <T>(message: T) => {
  client.publish(
      'message',
      JSON.stringify(message),
  )
}
