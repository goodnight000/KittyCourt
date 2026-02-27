import { Composition } from "remotion";
import { AppStoreVideo } from "./AppStoreVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="AppStoreVideo"
      component={AppStoreVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
