FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

# Copy config as template — envsubst replaces ${BACKEND_HOST} at startup
COPY nginx.conf /etc/nginx/nginx.conf.template

COPY public/ /usr/share/nginx/html/

# Use envsubst to inject BACKEND_HOST, then start nginx
# Only substitute ${BACKEND_HOST} to preserve nginx $variables ($uri, $host, etc.)
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]

EXPOSE 80
