const imageUtils = {
    marginImage: ({
        img,
        graphics = window,
        boundary = graphics,
        margin = 0,
        scale = 1,
        callback,
        center = false,
        fill = false,
        position = createVector(),
    }) => {
        const availableWidth = fill ? boundary.height - margin : boundary.width - 2 * margin;
        const availableHeight = fill ? boundary.width - margin : boundary.height - 2 * margin;
        const screenHeightScale = (availableHeight / img.height)
        const screenWidthScale = (availableWidth / img.width)
        const screenScale = img.width > img.height ? screenHeightScale : screenWidthScale;

        const h = img.height * screenScale * scale;
        const w = img.width * screenScale * scale;

        if (center) {
            position.x -= w / 2;
            position.y -= h / 2;
        }

        graphics.image(
            img,
            position.x,
            position.y,
            w,
            h
        );

        callback?.(position.x, position.y, w, h);
    }
};

export default imageUtils;
