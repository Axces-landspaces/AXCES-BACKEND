# this is the base image lightweight nodejs
FROM node:22.9.0-alpine
# this is the working directory of the docker container, where our project is going to reside
WORKDIR /app 
# this will copy the entire project to the /app dir
# but use layering concept
# thats what two dot represent
COPY . .   
RUN npm install
EXPOSE 5000
# all of the above will run when create the image

# this cmd will run when you start the container
CMD ["npm","run","start"]