import requests
import os

class ArenaUploader:
    def __init__(self, access_token):
        self.access_token = access_token
        self.base_url = "https://api.are.na/v2"
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    def create_channel(self, title, status="public"):
        url = f"{self.base_url}/channels"
        data = {
            "title": title,
            "status": status
        }
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()

    def add_block_to_channel(self, channel_slug, content, title=None, description=None):
        url = f"{self.base_url}/channels/{channel_slug}/blocks"
        data = {
            "content": content,
            "title": title,
            "description": description
        }
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()

def upload_pinterest_data_to_arena(pinterest_data_dir, arena_channel_slug, arena_uploader):
    for filename in os.listdir(pinterest_data_dir):
        if filename.endswith(".md"):
            with open(os.path.join(pinterest_data_dir, filename), 'r') as f:
                content = f.read()
            
            # Extract title and description from markdown content
            lines = content.split("\n")
            title = lines[0].strip("# ")
            description = "\n".join(lines[3:])
            
            # Find corresponding image file
            image_filename = lines[2].split("(")[1].split(")")[0]
            image_path = os.path.join(pinterest_data_dir, image_filename)
            
            # Upload image to Are.na
            with open(image_path, 'rb') as image_file:
                files = {'file': image_file}
                response = requests.post(
                    f"{arena_uploader.base_url}/channels/{arena_channel_slug}/blocks",
                    headers={"Authorization": f"Bearer {arena_uploader.access_token}"},
                    files=files,
                    data={"title": title, "description": description}
                )
            
            print(f"Uploaded {filename} to Are.na")

def main():
    arena_access_token = "your_arena_access_token"
    arena_channel_slug = "your-channel-slug"
    pinterest_data_dir = "pinterest_data"

    arena_uploader = ArenaUploader(arena_access_token)
    upload_pinterest_data_to_arena(pinterest_data_dir, arena_channel_slug, arena_uploader)

if __name__ == "__main__":
    main()
