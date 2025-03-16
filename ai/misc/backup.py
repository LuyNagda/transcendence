import os, re

def backup_file(filename, nb_generation):
    if(nb_generation % 100 != 0):
        return

    new_filename = generate_unique_filename(filename, nb_generation)

    try:
        # Open source file in binary read mode
        with open(filename, 'rb') as source_file:
            # Open destination file in binary write mode
            with open(new_filename, 'wb') as dest_file:
                # Read and write file contents in chunks to handle large files
                while True:
                    chunk = source_file.read(4096)  # Read 4KB at a time
                    if not chunk:
                        break
                    # Save the file with the new name
                    dest_file.write(chunk)
                
                print("Back-up complete: ", new_filename)

    except Exception as e:
        print(f"Save copy error: {e}")
        return

def generate_unique_filename(filename, nb_generation):
    """
    Generate a unique filename by adding version suffixes if the file already exists.
    
    :param filename: Original filename
    :param nb_generation: Generation number to append
    :return: A unique filename that doesn't exist
    """

    # Extract the base filename and existing number (if any)
    match = re.search(r'(.+)_(\d+)(?:_v\d+)?$', filename)
        # (.+) captures the base filename
        # _(\d+) captures the underscore and the number
        # (?:_v\d+)? is a non-capturing group that optionally matches _v followed by one or more digits
        # $ ensures this pattern is at the end of the filename

    if match:
        # If file already has a number, increment it
        base_name = match.group(1)
        current_number = int(match.group(2))
        new_number = current_number + nb_generation
        new_filename = f"{base_name}_{new_number}"
    else:
        # If no number exists, append the generation number
        new_filename = f"{filename}_{nb_generation}"
    
    # Check if the file exists, and if so, add version suffixes
    version = 2
    original_new_filename = new_filename
    
    while os.path.exists(new_filename):
        # Add or increment version suffix
        new_filename = f"{original_new_filename}_v{version}"
        version += 1
    
    return new_filename